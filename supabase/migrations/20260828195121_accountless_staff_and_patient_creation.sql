-- Staff members are operational clinic records first. A login account can be
-- linked later, but is no longer required when an administrator creates staff.
alter table public.clinic_members
  add column id uuid default gen_random_uuid();

update public.clinic_members
set id = gen_random_uuid()
where id is null;

alter table public.clinic_members
  alter column id set not null,
  drop constraint clinic_members_pkey,
  alter column user_id drop not null,
  add constraint clinic_members_pkey primary key (id),
  add constraint clinic_members_clinic_user_unique unique (clinic_id, user_id);

-- Creating a patient is atomic so a dentist/hygienist is assigned before RLS
-- evaluates later reads. This avoids an inserted row becoming invisible to its
-- creator and keeps the patient/assignment tenant relationship consistent.
create or replace function public.create_patient(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_patient_number text,
  p_full_name text,
  p_phone text,
  p_email text,
  p_date_of_birth date,
  p_gender text,
  p_allergies text[],
  p_medical_conditions text[],
  p_notes text,
  p_status text,
  p_outstanding_balance numeric
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role public.clinic_role;
  normalized_name text := trim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  resolved_first_name text;
  resolved_last_name text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select member.role into caller_role
  from public.clinic_members member
  where member.clinic_id = p_clinic_id
    and member.user_id = caller_id
    and member.status = 'active'
  limit 1;

  if caller_role is null or caller_role not in
    ('owner','admin','dentist','hygienist','assistant','front_desk') then
    raise exception 'Insufficient clinic permission';
  end if;
  if normalized_name = '' then raise exception 'Patient name is required'; end if;
  if nullif(trim(p_patient_number), '') is null then raise exception 'Patient number is required'; end if;
  if p_phone is null or p_phone !~ '^\+9647[0-9]{9}$' then
    raise exception 'Enter a valid Iraqi mobile number (07XXXXXXXXX or +9647XXXXXXXXX)';
  end if;
  if p_email is not null and trim(p_email) <> ''
    and trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if p_gender not in ('Female','Male','Other') then raise exception 'Invalid gender'; end if;
  if p_status not in ('active','inactive') then raise exception 'Invalid patient status'; end if;
  if coalesce(p_outstanding_balance, 0) < 0 then raise exception 'Invalid outstanding balance'; end if;

  resolved_first_name := split_part(normalized_name, ' ', 1);
  resolved_last_name := regexp_replace(normalized_name, '^\S+\s*', '');

  insert into public.patients (
    id, clinic_id, patient_number, first_name, last_name, date_of_birth,
    gender, phone, email, allergies, medical_conditions, notes, status,
    outstanding_balance, created_by
  ) values (
    p_patient_id, p_clinic_id, trim(p_patient_number), resolved_first_name,
    resolved_last_name, p_date_of_birth, p_gender, p_phone,
    nullif(lower(trim(p_email)), ''), coalesce(p_allergies, '{}'),
    coalesce(p_medical_conditions, '{}'), coalesce(p_notes, ''), p_status,
    coalesce(p_outstanding_balance, 0), caller_id
  );

  if caller_role in ('dentist','hygienist') then
    insert into public.doctor_patient_assignments
      (clinic_id, doctor_id, patient_id, assigned_by)
    values (p_clinic_id, caller_id, p_patient_id, caller_id)
    on conflict do nothing;
  end if;

  return p_patient_id;
end;
$$;

revoke all on function public.create_patient(
  uuid, uuid, text, text, text, text, date, text, text[], text[], text,
  text, numeric
) from public, anon;
grant execute on function public.create_patient(
  uuid, uuid, text, text, text, text, date, text, text[], text[], text,
  text, numeric
) to authenticated;

-- Keep accountless staff and newly created patients synchronized in other
-- active clinic sessions.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'patients'
  ) then
    alter publication supabase_realtime add table public.patients;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clinic_members'
  ) then
    alter publication supabase_realtime add table public.clinic_members;
  end if;
end $$;
