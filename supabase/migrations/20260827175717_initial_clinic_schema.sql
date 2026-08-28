create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.clinic_role as enum ('owner', 'admin', 'dentist', 'hygienist', 'assistant', 'front_desk', 'billing', 'viewer');
create type public.member_status as enum ('invited', 'active', 'suspended');

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  phone text,
  email text,
  address jsonb not null default '{}'::jsonb,
  timezone text not null default 'America/Los_Angeles',
  currency text not null default 'USD',
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinic_members (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.clinic_role not null default 'viewer',
  status public.member_status not null default 'invited',
  full_name text not null default '',
  specialty text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);
create index clinic_members_user_id_idx on public.clinic_members(user_id);

create function private.is_clinic_member(check_clinic_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clinic_members
    where clinic_id = check_clinic_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

create function private.has_clinic_role(check_clinic_id uuid, allowed_roles public.clinic_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clinic_members
    where clinic_id = check_clinic_id
      and user_id = (select auth.uid())
      and status = 'active'
      and role = any(allowed_roles)
  );
$$;

create function private.is_clinic_member_path(clinic_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clinic_members
    where clinic_id::text = clinic_path
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

revoke all on function private.is_clinic_member(uuid) from public;
revoke all on function private.has_clinic_role(uuid, public.clinic_role[]) from public;
revoke all on function private.is_clinic_member_path(text) from public;
grant execute on function private.is_clinic_member(uuid) to authenticated;
grant execute on function private.has_clinic_role(uuid, public.clinic_role[]) to authenticated;
grant execute on function private.is_clinic_member_path(text) to authenticated;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_number text not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  gender text check (gender in ('Female', 'Male', 'Other')),
  phone text,
  email text,
  address jsonb not null default '{}'::jsonb,
  emergency_contact jsonb not null default '{}'::jsonb,
  allergies text[] not null default '{}',
  medical_conditions text[] not null default '{}',
  medications text[] not null default '{}',
  notes text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive')),
  outstanding_balance numeric(12,2) not null default 0,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, patient_number)
);
create index patients_clinic_id_idx on public.patients(clinic_id);
create index patients_clinic_name_idx on public.patients(clinic_id, last_name, first_name);

create table public.dental_chart (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  tooth_number smallint not null check (tooth_number between 1 and 32),
  condition text not null check (condition in ('Healthy','Caries','Filling','Crown','Root Canal','Implant','Extraction','Missing')),
  surfaces text[] not null default '{}',
  note text,
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, tooth_number)
);
create index dental_chart_clinic_id_idx on public.dental_chart(clinic_id);
create index dental_chart_patient_id_idx on public.dental_chart(patient_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  provider_id uuid references auth.users(id),
  doctor_name text,
  title text not null,
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  room text,
  status text not null default 'Pending' check (status in ('Confirmed','Checked in','In treatment','Completed','Pending','Cancelled')),
  color text not null default '#0f9f8f',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index appointments_clinic_start_idx on public.appointments(clinic_id, starts_at);
create index appointments_patient_id_idx on public.appointments(patient_id);
create index appointments_provider_id_idx on public.appointments(provider_id);

create table public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  title text not null,
  status text not null default 'Proposed' check (status in ('Proposed','In progress','Completed','On hold')),
  total_amount numeric(12,2) not null default 0,
  sessions_total integer not null default 1 check (sessions_total > 0),
  sessions_completed integer not null default 0 check (sessions_completed >= 0),
  next_session_at timestamptz,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sessions_completed <= sessions_total)
);
create index treatment_plans_clinic_id_idx on public.treatment_plans(clinic_id);
create index treatment_plans_patient_id_idx on public.treatment_plans(patient_id);

create table public.treatment_plan_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  treatment_plan_id uuid not null,
  procedure_code text,
  procedure_name text not null,
  tooth_number smallint check (tooth_number between 1 and 32),
  price numeric(12,2) not null default 0,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'planned' check (status in ('planned','scheduled','completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index treatment_plan_items_clinic_id_idx on public.treatment_plan_items(clinic_id);
create index treatment_plan_items_plan_id_idx on public.treatment_plan_items(treatment_plan_id);

create table public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  appointment_id uuid,
  record_type text not null,
  title text not null,
  body text not null,
  vitals jsonb not null default '{}'::jsonb,
  diagnosis_codes text[] not null default '{}',
  author_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clinical_records_clinic_id_idx on public.clinical_records(clinic_id);
create index clinical_records_patient_id_idx on public.clinical_records(patient_id);

create table public.patient_files (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null default 0,
  category text not null default 'clinical_image',
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index patient_files_clinic_id_idx on public.patient_files(clinic_id);
create index patient_files_patient_id_idx on public.patient_files(patient_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  treatment_plan_id uuid,
  invoice_number text not null,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'open' check (status in ('draft','open','partial','paid','overdue','void')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, invoice_number)
);
create index invoices_clinic_id_idx on public.invoices(clinic_id);
create index invoices_patient_id_idx on public.invoices(patient_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  invoice_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('Card','Cash','Insurance','Bank transfer')),
  reference text,
  paid_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index payments_clinic_id_idx on public.payments(clinic_id);
create index payments_invoice_id_idx on public.payments(invoice_id);

create table public.payment_installments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  invoice_id uuid not null,
  due_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'scheduled' check (status in ('scheduled','paid','overdue','cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index payment_installments_clinic_id_idx on public.payment_installments(clinic_id);
create index payment_installments_invoice_id_idx on public.payment_installments(invoice_id);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  category text not null,
  sku text not null,
  quantity numeric(12,2) not null default 0,
  reorder_level numeric(12,2) not null default 0,
  unit text not null default 'units',
  supplier text,
  unit_cost numeric(12,2) not null default 0,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, sku)
);
create index inventory_items_clinic_id_idx on public.inventory_items(clinic_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  inventory_item_id uuid not null,
  quantity_delta numeric(12,2) not null,
  reason text not null,
  reference_id uuid,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index inventory_movements_clinic_id_idx on public.inventory_movements(clinic_id);
create index inventory_movements_item_id_idx on public.inventory_movements(inventory_item_id);

create table public.clinic_settings (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  appointment_reminders jsonb not null default '{"email":true,"sms":true,"hours_before":24}'::jsonb,
  invoice_footer text,
  business_hours jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Pair every child record with its tenant at the foreign-key level. This prevents
-- a valid patient or invoice UUID from another clinic being attached to a row in
-- the current clinic, even if an application bug supplies mismatched IDs.
alter table public.patients add constraint patients_id_clinic_unique unique (id, clinic_id);
alter table public.appointments add constraint appointments_id_clinic_unique unique (id, clinic_id);
alter table public.treatment_plans add constraint treatment_plans_id_clinic_unique unique (id, clinic_id);
alter table public.invoices add constraint invoices_id_clinic_unique unique (id, clinic_id);
alter table public.inventory_items add constraint inventory_items_id_clinic_unique unique (id, clinic_id);

alter table public.dental_chart add constraint dental_chart_patient_tenant_fk foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete cascade;
alter table public.appointments add constraint appointments_patient_tenant_fk foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete restrict;
alter table public.treatment_plans add constraint treatment_plans_patient_tenant_fk foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete restrict;
alter table public.treatment_plan_items add constraint treatment_items_plan_tenant_fk foreign key (treatment_plan_id, clinic_id) references public.treatment_plans(id, clinic_id) on delete cascade;
alter table public.clinical_records add constraint clinical_records_patient_tenant_fk foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete cascade;
alter table public.clinical_records add constraint clinical_records_appointment_tenant_fk foreign key (appointment_id, clinic_id) references public.appointments(id, clinic_id) on delete set null (appointment_id);
alter table public.patient_files add constraint patient_files_patient_tenant_fk foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete cascade;
alter table public.invoices add constraint invoices_patient_tenant_fk foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete restrict;
alter table public.invoices add constraint invoices_plan_tenant_fk foreign key (treatment_plan_id, clinic_id) references public.treatment_plans(id, clinic_id) on delete set null (treatment_plan_id);
alter table public.payments add constraint payments_invoice_tenant_fk foreign key (invoice_id, clinic_id) references public.invoices(id, clinic_id) on delete restrict;
alter table public.payment_installments add constraint installments_invoice_tenant_fk foreign key (invoice_id, clinic_id) references public.invoices(id, clinic_id) on delete cascade;
alter table public.inventory_movements add constraint inventory_movements_item_tenant_fk foreign key (inventory_item_id, clinic_id) references public.inventory_items(id, clinic_id) on delete cascade;

create function private.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['clinics','clinic_members','patients','dental_chart','appointments','treatment_plans','clinical_records','invoices','inventory_items','clinic_settings']
  loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function private.set_updated_at()', table_name, table_name);
  end loop;
end $$;

create function public.create_clinic(clinic_name text, clinic_slug text, member_name text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_clinic_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  insert into public.clinics(name, slug) values (clinic_name, clinic_slug) returning id into new_clinic_id;
  insert into public.clinic_members(clinic_id, user_id, role, status, full_name)
  values (new_clinic_id, (select auth.uid()), 'owner', 'active', member_name);
  insert into public.clinic_settings(clinic_id) values (new_clinic_id);
  return new_clinic_id;
end;
$$;
revoke all on function public.create_clinic(text, text, text) from public, anon;
grant execute on function public.create_clinic(text, text, text) to authenticated;

create function public.record_clinic_payment(
  p_clinic_id uuid, p_patient_id uuid, p_invoice_number text, p_total_amount numeric,
  p_paid_amount numeric, p_discount_amount numeric, p_method text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_invoice_id uuid;
begin
  insert into public.invoices(clinic_id, patient_id, invoice_number, subtotal, discount_amount, total_amount, status)
  values (p_clinic_id, p_patient_id, p_invoice_number, p_total_amount, p_discount_amount, p_total_amount,
    case when p_paid_amount + p_discount_amount >= p_total_amount then 'paid' else 'partial' end)
  returning id into new_invoice_id;
  insert into public.payments(clinic_id, invoice_id, amount, method, recorded_by)
  values (p_clinic_id, new_invoice_id, p_paid_amount, p_method, (select auth.uid()));
  return new_invoice_id;
end;
$$;
revoke all on function public.record_clinic_payment(uuid, uuid, text, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.record_clinic_payment(uuid, uuid, text, numeric, numeric, numeric, text) to authenticated;

alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.patients enable row level security;
alter table public.dental_chart enable row level security;
alter table public.appointments enable row level security;
alter table public.treatment_plans enable row level security;
alter table public.treatment_plan_items enable row level security;
alter table public.clinical_records enable row level security;
alter table public.patient_files enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.payment_installments enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.clinic_settings enable row level security;

create policy clinics_select on public.clinics for select to authenticated using ((select private.is_clinic_member(id)));
create policy clinics_update on public.clinics for update to authenticated using ((select private.has_clinic_role(id, array['owner','admin']::public.clinic_role[]))) with check ((select private.has_clinic_role(id, array['owner','admin']::public.clinic_role[])));
create policy members_select on public.clinic_members for select to authenticated using ((select private.is_clinic_member(clinic_id)));
create policy members_insert on public.clinic_members for insert to authenticated with check ((select private.has_clinic_role(clinic_id, array['owner','admin']::public.clinic_role[])));
create policy members_update on public.clinic_members for update to authenticated using ((select private.has_clinic_role(clinic_id, array['owner','admin']::public.clinic_role[]))) with check ((select private.has_clinic_role(clinic_id, array['owner','admin']::public.clinic_role[])));
create policy members_delete on public.clinic_members for delete to authenticated using ((select private.has_clinic_role(clinic_id, array['owner']::public.clinic_role[])));

do $$
declare table_name text;
begin
  foreach table_name in array array['patients','appointments','treatment_plans','treatment_plan_items','patient_files']
  loop
    execute format('create policy %I_select on public.%I for select to authenticated using ((select private.is_clinic_member(clinic_id)))', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''dentist'',''hygienist'',''assistant'',''front_desk'']::public.clinic_role[])))', table_name, table_name);
    execute format('create policy %I_update on public.%I for update to authenticated using ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''dentist'',''hygienist'',''assistant'',''front_desk'']::public.clinic_role[]))) with check ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''dentist'',''hygienist'',''assistant'',''front_desk'']::public.clinic_role[])))', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete to authenticated using ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''dentist'']::public.clinic_role[])))', table_name, table_name);
  end loop;
end $$;

create policy dental_chart_select on public.dental_chart for select to authenticated using ((select private.is_clinic_member(clinic_id)));
create policy dental_chart_insert on public.dental_chart for insert to authenticated with check ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[])));
create policy dental_chart_update on public.dental_chart for update to authenticated using ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[]))) with check ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[])));
create policy dental_chart_delete on public.dental_chart for delete to authenticated using ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist']::public.clinic_role[])));

create policy clinical_records_select on public.clinical_records for select to authenticated using ((select private.is_clinic_member(clinic_id)));
create policy clinical_records_insert on public.clinical_records for insert to authenticated with check ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[])) and author_id = (select auth.uid()));
create policy clinical_records_update on public.clinical_records for update to authenticated using (((author_id = (select auth.uid())) and (select private.is_clinic_member(clinic_id))) or (select private.has_clinic_role(clinic_id, array['owner','admin']::public.clinic_role[]))) with check ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[])));
create policy clinical_records_delete on public.clinical_records for delete to authenticated using ((select private.has_clinic_role(clinic_id, array['owner','admin']::public.clinic_role[])));

do $$
declare table_name text;
begin
  foreach table_name in array array['invoices','payments','payment_installments']
  loop
    execute format('create policy %I_select on public.%I for select to authenticated using ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''billing'',''front_desk'',''dentist'']::public.clinic_role[])))', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''billing'',''front_desk'']::public.clinic_role[])))', table_name, table_name);
    execute format('create policy %I_update on public.%I for update to authenticated using ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''billing'']::public.clinic_role[]))) with check ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''billing'']::public.clinic_role[])))', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete to authenticated using ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'']::public.clinic_role[])))', table_name, table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['inventory_items','inventory_movements']
  loop
    execute format('create policy %I_select on public.%I for select to authenticated using ((select private.is_clinic_member(clinic_id)))', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''assistant'']::public.clinic_role[])))', table_name, table_name);
    execute format('create policy %I_update on public.%I for update to authenticated using ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''assistant'']::public.clinic_role[]))) with check ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''assistant'']::public.clinic_role[])))', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete to authenticated using ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'']::public.clinic_role[])))', table_name, table_name);
  end loop;
end $$;

create policy clinic_settings_select on public.clinic_settings for select to authenticated using ((select private.is_clinic_member(clinic_id)));
create policy clinic_settings_insert on public.clinic_settings for insert to authenticated with check ((select private.has_clinic_role(clinic_id, array['owner','admin']::public.clinic_role[])));
create policy clinic_settings_update on public.clinic_settings for update to authenticated using ((select private.has_clinic_role(clinic_id, array['owner','admin']::public.clinic_role[]))) with check ((select private.has_clinic_role(clinic_id, array['owner','admin']::public.clinic_role[])));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('clinical-files', 'clinical-files', false, 20971520, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy clinical_files_select on storage.objects for select to authenticated
using (bucket_id = 'clinical-files' and (select private.is_clinic_member_path((storage.foldername(name))[1])));
create policy clinical_files_insert on storage.objects for insert to authenticated
with check (bucket_id = 'clinical-files' and (select private.is_clinic_member_path((storage.foldername(name))[1])));
create policy clinical_files_update on storage.objects for update to authenticated
using (bucket_id = 'clinical-files' and (select private.is_clinic_member_path((storage.foldername(name))[1])))
with check (bucket_id = 'clinical-files' and (select private.is_clinic_member_path((storage.foldername(name))[1])));
create policy clinical_files_delete on storage.objects for delete to authenticated
using (bucket_id = 'clinical-files' and (select private.is_clinic_member_path((storage.foldername(name))[1])));

grant select, insert, update, delete on public.clinics, public.clinic_members, public.patients,
  public.dental_chart, public.appointments, public.treatment_plans, public.treatment_plan_items,
  public.clinical_records, public.patient_files, public.invoices, public.payments,
  public.payment_installments, public.inventory_items, public.inventory_movements,
  public.clinic_settings to authenticated;

alter publication supabase_realtime add table public.appointments, public.payments, public.inventory_items;
