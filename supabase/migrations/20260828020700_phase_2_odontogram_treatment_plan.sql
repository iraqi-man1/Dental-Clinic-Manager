-- Phase 2: normalize the odontogram and extend (without replacing) the
-- existing treatment-plan, invoice, and payment model.

create table public.procedure_catalog (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  code text,
  name text not null,
  category text not null default 'General',
  default_price numeric(12,2) not null default 0 check (default_price >= 0),
  default_sessions integer not null default 1 check (default_sessions > 0),
  supports_surfaces boolean not null default false,
  supports_multiple_teeth boolean not null default false,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id)
);
create unique index procedure_catalog_clinic_name_unique
  on public.procedure_catalog (clinic_id, lower(name));
create index procedure_catalog_clinic_active_idx
  on public.procedure_catalog (clinic_id, is_active, category, name);

create table public.dental_chart_surfaces (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  tooth_number smallint not null check (tooth_number between 1 and 32),
  surface text not null check (surface in ('occlusal','mesial','distal','buccal','lingual')),
  state text not null check (state in ('healthy','decay','existing_restoration','planned','completed','other')),
  note text,
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, tooth_number, surface),
  foreign key (patient_id, clinic_id)
    references public.patients(id, clinic_id) on delete cascade
);
create index dental_chart_surfaces_clinic_patient_idx
  on public.dental_chart_surfaces (clinic_id, patient_id, tooth_number);

alter table public.treatment_plan_items
  add column procedure_id uuid,
  add column tooth_numbers smallint[] not null default '{}',
  add column surfaces text[] not null default '{}',
  add column sessions_total integer not null default 1 check (sessions_total > 0),
  add column sessions_completed integer not null default 0 check (sessions_completed >= 0),
  add column discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  add column amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  add column notes text,
  add column updated_at timestamptz not null default now(),
  add constraint treatment_plan_items_sessions_check check (sessions_completed <= sessions_total),
  add constraint treatment_plan_items_discount_check check (discount_amount <= price * quantity),
  add constraint treatment_plan_items_teeth_check check (
    tooth_numbers <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
      17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32]::smallint[]
  ),
  add constraint treatment_plan_items_surfaces_check check (
    surfaces <@ array['occlusal','mesial','distal','buccal','lingual']::text[]
  );

update public.treatment_plan_items
set tooth_numbers = array[tooth_number]::smallint[]
where tooth_number is not null and cardinality(tooth_numbers) = 0;

alter table public.treatment_plan_items
  add constraint treatment_items_procedure_tenant_fk
  foreign key (procedure_id, clinic_id)
  references public.procedure_catalog(id, clinic_id) on delete restrict;
alter table public.treatment_plan_items
  add constraint treatment_plan_items_id_clinic_unique unique (id, clinic_id);
alter table public.payments
  add constraint payments_id_clinic_unique unique (id, clinic_id);

create unique index treatment_plan_items_selection_unique
  on public.treatment_plan_items (treatment_plan_id, procedure_id, tooth_numbers, surfaces)
  where procedure_id is not null and status <> 'cancelled';

create table public.treatment_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  treatment_plan_item_id uuid not null,
  appointment_id uuid,
  session_number integer not null check (session_number > 0),
  status text not null default 'planned' check (status in ('planned','scheduled','completed','cancelled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (treatment_plan_item_id, session_number),
  foreign key (treatment_plan_item_id, clinic_id)
    references public.treatment_plan_items(id, clinic_id) on delete cascade,
  foreign key (appointment_id, clinic_id)
    references public.appointments(id, clinic_id) on delete set null (appointment_id)
);
create index treatment_sessions_clinic_item_idx
  on public.treatment_sessions (clinic_id, treatment_plan_item_id, session_number);

create table public.treatment_item_payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  treatment_plan_item_id uuid not null,
  payment_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (treatment_plan_item_id, payment_id),
  foreign key (treatment_plan_item_id, clinic_id)
    references public.treatment_plan_items(id, clinic_id) on delete cascade,
  foreign key (payment_id, clinic_id)
    references public.payments(id, clinic_id) on delete cascade
);
create index treatment_item_payments_clinic_item_idx
  on public.treatment_item_payments (clinic_id, treatment_plan_item_id);

create trigger set_procedure_catalog_updated_at
  before update on public.procedure_catalog
  for each row execute function private.set_updated_at();
create trigger set_dental_chart_surfaces_updated_at
  before update on public.dental_chart_surfaces
  for each row execute function private.set_updated_at();
create trigger set_treatment_plan_items_updated_at
  before update on public.treatment_plan_items
  for each row execute function private.set_updated_at();
create trigger set_treatment_sessions_updated_at
  before update on public.treatment_sessions
  for each row execute function private.set_updated_at();

create function private.seed_clinic_procedures(target_clinic_id uuid)
returns void language sql security invoker set search_path = '' as $$
  insert into public.procedure_catalog
    (clinic_id, code, name, category, default_price, default_sessions,
     supports_surfaces, supports_multiple_teeth, is_system)
  values
    (target_clinic_id, 'FILL', 'Filling', 'Restorative', 180, 1, true, false, true),
    (target_clinic_id, 'CROWN', 'Crown', 'Restorative', 950, 2, false, false, true),
    (target_clinic_id, 'RCT', 'Root Canal', 'Endodontic', 850, 2, false, false, true),
    (target_clinic_id, 'EXT', 'Extraction', 'Surgical', 260, 1, false, false, true),
    (target_clinic_id, 'IMPL', 'Implant', 'Surgical', 2400, 4, false, false, true),
    (target_clinic_id, 'BRIDGE', 'Bridge', 'Restorative', 2100, 3, false, true, true),
    (target_clinic_id, 'VEN', 'Veneer', 'Cosmetic', 780, 2, false, true, true),
    (target_clinic_id, 'WHITE', 'Whitening / Cosmetic Treatment', 'Cosmetic', 420, 1, false, true, true),
    (target_clinic_id, 'PERIO', 'Periodontal Treatment', 'Periodontal', 340, 2, true, true, true),
    (target_clinic_id, 'MISS', 'Missing Tooth', 'Diagnostic', 0, 1, false, false, true)
  on conflict do nothing;
$$;

select private.seed_clinic_procedures(id) from public.clinics;

create function private.seed_procedures_for_new_clinic()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform private.seed_clinic_procedures(new.id);
  return new;
end;
$$;
create trigger seed_procedures_after_clinic_insert
  after insert on public.clinics
  for each row execute function private.seed_procedures_for_new_clinic();

create function public.save_odontogram_plan_item(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_plan_id uuid,
  p_plan_title text,
  p_procedure_id uuid,
  p_procedure_name text,
  p_tooth_numbers smallint[],
  p_surfaces text[],
  p_chart_state text,
  p_status text,
  p_price numeric,
  p_discount_amount numeric,
  p_sessions_total integer,
  p_notes text default null
) returns table (treatment_plan_id uuid, treatment_plan_item_id uuid)
language plpgsql security invoker set search_path = '' as $$
declare
  resolved_plan_id uuid;
  resolved_procedure_id uuid;
  resolved_procedure_name text;
  resolved_item_id uuid;
  normalized_teeth smallint[];
  normalized_surfaces text[];
  tooth smallint;
  tooth_surface text;
begin
  if not (select private.has_clinic_role(
    p_clinic_id,
    array['owner','admin','dentist','hygienist']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;

  select coalesce(array_agg(v order by v), '{}'::smallint[])
    into normalized_teeth
  from (select distinct unnest(coalesce(p_tooth_numbers, '{}'::smallint[])) as v) teeth;
  select coalesce(array_agg(v order by v), '{}'::text[])
    into normalized_surfaces
  from (select distinct unnest(coalesce(p_surfaces, '{}'::text[])) as v) selected_surfaces;

  if exists (select 1 from unnest(normalized_teeth) v where v not between 1 and 32)
    then raise exception 'Invalid tooth number'; end if;
  if exists (select 1 from unnest(normalized_surfaces) v where v not in ('occlusal','mesial','distal','buccal','lingual'))
    then raise exception 'Invalid tooth surface'; end if;
  if p_chart_state not in ('healthy','decay','existing_restoration','planned','completed','other')
    then raise exception 'Invalid chart state'; end if;
  if p_status not in ('planned','scheduled','completed','cancelled')
    then raise exception 'Invalid treatment status'; end if;

  if p_procedure_id is null then
    insert into public.procedure_catalog
      (clinic_id, name, category, default_price, default_sessions,
       supports_surfaces, supports_multiple_teeth, is_system)
    values
      (p_clinic_id, nullif(trim(p_procedure_name), ''), 'Custom', greatest(p_price, 0),
       greatest(p_sessions_total, 1), cardinality(normalized_surfaces) > 0,
       cardinality(normalized_teeth) > 1, false)
    on conflict do nothing
    returning id, name into resolved_procedure_id, resolved_procedure_name;
    if resolved_procedure_id is null then
      select id, name into resolved_procedure_id, resolved_procedure_name
      from public.procedure_catalog
      where clinic_id = p_clinic_id and lower(name) = lower(trim(p_procedure_name));
    end if;
  else
    select id, name into resolved_procedure_id, resolved_procedure_name
    from public.procedure_catalog
    where id = p_procedure_id and clinic_id = p_clinic_id and is_active;
  end if;
  if resolved_procedure_id is null then raise exception 'Procedure not found'; end if;

  if p_plan_id is not null then
    select id into resolved_plan_id from public.treatment_plans
    where id = p_plan_id and clinic_id = p_clinic_id and patient_id = p_patient_id;
  else
    select id into resolved_plan_id from public.treatment_plans
    where clinic_id = p_clinic_id and patient_id = p_patient_id
      and status in ('Proposed','In progress','On hold')
    order by updated_at desc limit 1;
  end if;
  if resolved_plan_id is null then
    insert into public.treatment_plans
      (clinic_id, patient_id, title, status, created_by)
    values
      (p_clinic_id, p_patient_id, coalesce(nullif(trim(p_plan_title), ''), 'Dental treatment plan'),
       'Proposed', (select auth.uid()))
    returning id into resolved_plan_id;
  end if;

  select id into resolved_item_id
  from public.treatment_plan_items
  where treatment_plan_id = resolved_plan_id
    and procedure_id = resolved_procedure_id
    and tooth_numbers = normalized_teeth
    and surfaces = normalized_surfaces
    and status <> 'cancelled'
  limit 1;

  if resolved_item_id is null then
    insert into public.treatment_plan_items
      (clinic_id, treatment_plan_id, procedure_id, procedure_code, procedure_name,
       tooth_number, tooth_numbers, surfaces, price, quantity, status,
       sessions_total, sessions_completed, discount_amount, notes, completed_at)
    select
      p_clinic_id, resolved_plan_id, resolved_procedure_id, catalog.code, catalog.name,
      normalized_teeth[1], normalized_teeth, normalized_surfaces, greatest(p_price, 0), 1,
      p_status, greatest(p_sessions_total, 1), case when p_status = 'completed' then greatest(p_sessions_total, 1) else 0 end,
      least(greatest(p_discount_amount, 0), greatest(p_price, 0)), p_notes,
      case when p_status = 'completed' then now() else null end
    from public.procedure_catalog catalog where catalog.id = resolved_procedure_id
    returning id into resolved_item_id;
  else
    update public.treatment_plan_items set
      price = greatest(p_price, 0),
      status = p_status,
      sessions_total = greatest(p_sessions_total, sessions_completed, 1),
      sessions_completed = case when p_status = 'completed' then greatest(p_sessions_total, sessions_completed, 1) else sessions_completed end,
      discount_amount = least(greatest(p_discount_amount, 0), greatest(p_price, 0)),
      notes = p_notes,
      completed_at = case when p_status = 'completed' then coalesce(completed_at, now()) else null end
    where id = resolved_item_id;
  end if;

  insert into public.treatment_sessions
    (clinic_id, treatment_plan_item_id, session_number, status, completed_at, created_by)
  select p_clinic_id, resolved_item_id, n,
    case when p_status = 'completed' then 'completed' else 'planned' end,
    case when p_status = 'completed' then now() else null end,
    (select auth.uid())
  from generate_series(1, greatest(p_sessions_total, 1)) n
  on conflict (treatment_plan_item_id, session_number) do nothing;

  foreach tooth in array normalized_teeth loop
    if cardinality(normalized_surfaces) = 0 then
      insert into public.dental_chart
        (clinic_id, patient_id, tooth_number, condition, recorded_by)
      values
        (p_clinic_id, p_patient_id, tooth,
         case resolved_procedure_name
           when 'Missing Tooth' then 'Missing'
           when 'Extraction' then 'Extraction'
           when 'Implant' then 'Implant'
           when 'Crown' then 'Crown'
           when 'Root Canal' then 'Root Canal'
           else 'Healthy' end,
         (select auth.uid()))
      on conflict (patient_id, tooth_number) do update set
        condition = excluded.condition, recorded_by = excluded.recorded_by,
        recorded_at = now(), updated_at = now();
    else
      foreach tooth_surface in array normalized_surfaces loop
        insert into public.dental_chart_surfaces
          (clinic_id, patient_id, tooth_number, surface, state, note, recorded_by)
        values
          (p_clinic_id, p_patient_id, tooth, tooth_surface, p_chart_state, p_notes, (select auth.uid()))
        on conflict (patient_id, tooth_number, surface) do update set
          state = excluded.state, note = excluded.note, recorded_by = excluded.recorded_by,
          recorded_at = now(), updated_at = now();
      end loop;
    end if;
  end loop;

  update public.treatment_plans plan set
    total_amount = totals.total_amount,
    sessions_total = greatest(totals.sessions_total, 1),
    sessions_completed = least(totals.sessions_completed, greatest(totals.sessions_total, 1)),
    status = case
      when totals.item_count > 0 and totals.completed_count = totals.item_count then 'Completed'
      when totals.started_count > 0 then 'In progress'
      else plan.status end
  from (
    select treatment_plan_id,
      coalesce(sum(price * quantity - discount_amount), 0) total_amount,
      coalesce(sum(sessions_total), 0)::integer sessions_total,
      coalesce(sum(sessions_completed), 0)::integer sessions_completed,
      count(*) filter (where status <> 'cancelled') item_count,
      count(*) filter (where status = 'completed') completed_count,
      count(*) filter (where status in ('scheduled','completed')) started_count
    from public.treatment_plan_items where treatment_plan_id = resolved_plan_id
    group by treatment_plan_id
  ) totals where plan.id = totals.treatment_plan_id;

  return query select resolved_plan_id, resolved_item_id;
end;
$$;

revoke all on function public.save_odontogram_plan_item(
  uuid, uuid, uuid, text, uuid, text, smallint[], text[], text, text,
  numeric, numeric, integer, text
) from public, anon;
grant execute on function public.save_odontogram_plan_item(
  uuid, uuid, uuid, text, uuid, text, smallint[], text[], text, text,
  numeric, numeric, integer, text
) to authenticated;

create function public.record_treatment_session(p_clinic_id uuid, p_item_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  item public.treatment_plan_items%rowtype;
  next_session integer;
begin
  if not (select private.has_clinic_role(
    p_clinic_id,
    array['owner','admin','dentist','hygienist']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  select * into item from public.treatment_plan_items
  where id = p_item_id and clinic_id = p_clinic_id for update;
  if item.id is null or item.status = 'cancelled' then return false; end if;
  next_session := least(item.sessions_completed + 1, item.sessions_total);
  update public.treatment_plan_items set
    sessions_completed = next_session,
    status = case when next_session = sessions_total then 'completed' else 'scheduled' end,
    completed_at = case when next_session = sessions_total then now() else null end
  where id = item.id;
  update public.treatment_sessions set
    status = 'completed', completed_at = now()
  where treatment_plan_item_id = item.id and session_number = next_session;
  update public.treatment_plans plan set
    sessions_completed = totals.sessions_completed,
    status = case when totals.sessions_completed >= totals.sessions_total then 'Completed' else 'In progress' end
  from (
    select treatment_plan_id,
      sum(sessions_completed)::integer sessions_completed,
      sum(sessions_total)::integer sessions_total
    from public.treatment_plan_items
    where treatment_plan_id = item.treatment_plan_id and status <> 'cancelled'
    group by treatment_plan_id
  ) totals where plan.id = totals.treatment_plan_id;
  return true;
end;
$$;
revoke all on function public.record_treatment_session(uuid, uuid) from public, anon;
grant execute on function public.record_treatment_session(uuid, uuid) to authenticated;

alter table public.procedure_catalog enable row level security;
alter table public.dental_chart_surfaces enable row level security;
alter table public.treatment_sessions enable row level security;
alter table public.treatment_item_payments enable row level security;

create policy procedure_catalog_select on public.procedure_catalog for select to authenticated
  using ((select private.is_clinic_member(clinic_id)));
create policy procedure_catalog_insert on public.procedure_catalog for insert to authenticated
  with check ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist']::public.clinic_role[])));
create policy procedure_catalog_update on public.procedure_catalog for update to authenticated
  using ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist']::public.clinic_role[])))
  with check ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist']::public.clinic_role[])));
create policy procedure_catalog_delete on public.procedure_catalog for delete to authenticated
  using ((select private.has_clinic_role(clinic_id, array['owner','admin']::public.clinic_role[])) and not is_system);

do $$
declare table_name text;
begin
  foreach table_name in array array['dental_chart_surfaces','treatment_sessions'] loop
    execute format('create policy %I_select on public.%I for select to authenticated using ((select private.is_clinic_member(clinic_id)))', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''dentist'',''hygienist'']::public.clinic_role[])))', table_name, table_name);
    execute format('create policy %I_update on public.%I for update to authenticated using ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''dentist'',''hygienist'']::public.clinic_role[]))) with check ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''dentist'',''hygienist'']::public.clinic_role[])))', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete to authenticated using ((select private.has_clinic_role(clinic_id, array[''owner'',''admin'',''dentist'']::public.clinic_role[])))', table_name, table_name);
  end loop;
end $$;

create policy treatment_item_payments_select on public.treatment_item_payments for select to authenticated
  using ((select private.has_clinic_role(clinic_id, array['owner','admin','billing','front_desk','dentist']::public.clinic_role[])));
create policy treatment_item_payments_insert on public.treatment_item_payments for insert to authenticated
  with check ((select private.has_clinic_role(clinic_id, array['owner','admin','billing','front_desk']::public.clinic_role[])));
create policy treatment_item_payments_update on public.treatment_item_payments for update to authenticated
  using ((select private.has_clinic_role(clinic_id, array['owner','admin','billing']::public.clinic_role[])))
  with check ((select private.has_clinic_role(clinic_id, array['owner','admin','billing']::public.clinic_role[])));
create policy treatment_item_payments_delete on public.treatment_item_payments for delete to authenticated
  using ((select private.has_clinic_role(clinic_id, array['owner','admin']::public.clinic_role[])));

grant select, insert, update, delete on public.procedure_catalog,
  public.dental_chart_surfaces, public.treatment_sessions,
  public.treatment_item_payments to authenticated;

alter publication supabase_realtime add table public.treatment_plans,
  public.treatment_plan_items, public.dental_chart_surfaces,
  public.treatment_sessions;
