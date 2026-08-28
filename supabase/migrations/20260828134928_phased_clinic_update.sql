-- Complete phased clinic update: scheduling snapshots, appointment billing,
-- doctor assignments, receipts, and least-privilege tenant access.

alter table public.patients
  add column if not exists created_by uuid references auth.users(id);

alter table public.clinic_members
  add column if not exists email text;
create unique index if not exists clinic_members_clinic_email_unique
  on public.clinic_members (clinic_id, lower(email)) where email is not null;
update public.clinic_members member set email = auth_user.email
from auth.users auth_user
where auth_user.id = member.user_id and member.email is null;

alter table public.appointments
  add column if not exists procedure_id uuid,
  add column if not exists treatment_price numeric(12,2) not null default 0
    check (treatment_price >= 0);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_procedure_tenant_fk'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_procedure_tenant_fk
      foreign key (procedure_id, clinic_id)
      references public.procedure_catalog(id, clinic_id) on delete restrict;
  end if;
end $$;

alter table public.invoices
  add column if not exists appointment_id uuid,
  add column if not exists treatment_name text,
  add column if not exists original_price numeric(12,2) not null default 0
    check (original_price >= 0);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_appointment_tenant_fk'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_appointment_tenant_fk
      foreign key (appointment_id, clinic_id)
      references public.appointments(id, clinic_id) on delete restrict;
  end if;
end $$;

create unique index if not exists invoices_one_active_per_appointment_idx
  on public.invoices (clinic_id, appointment_id)
  where appointment_id is not null and status <> 'void';
create index if not exists invoices_appointment_id_idx
  on public.invoices (clinic_id, appointment_id);
create index if not exists appointments_procedure_id_idx
  on public.appointments (clinic_id, procedure_id);

alter table public.payments
  add column if not exists receipt_number text,
  add column if not exists treatment_name_snapshot text,
  add column if not exists original_price_snapshot numeric(12,2) not null default 0,
  add column if not exists amount_due_snapshot numeric(12,2) not null default 0,
  add column if not exists remaining_balance_snapshot numeric(12,2) not null default 0,
  add column if not exists clinic_snapshot jsonb not null default '{}'::jsonb;
create unique index if not exists payments_clinic_receipt_unique
  on public.payments (clinic_id, receipt_number)
  where receipt_number is not null;

create table if not exists public.doctor_patient_assignments (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null,
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (clinic_id, doctor_id, patient_id),
  foreign key (patient_id, clinic_id)
    references public.patients(id, clinic_id) on delete cascade
);
create index if not exists doctor_patient_assignments_doctor_idx
  on public.doctor_patient_assignments (doctor_id, clinic_id, patient_id);
create index if not exists doctor_patient_assignments_patient_idx
  on public.doctor_patient_assignments (patient_id, clinic_id, doctor_id);
alter table public.doctor_patient_assignments enable row level security;
revoke all on table public.doctor_patient_assignments from anon, authenticated;
grant select, insert, delete on table public.doctor_patient_assignments to authenticated;

-- New clinic workspaces must start empty. Existing price lists are deliberately
-- preserved; this only stops automatic seeding for future clinics.
drop trigger if exists seed_procedures_after_clinic_insert on public.clinics;

create or replace function private.current_clinic_role(check_clinic_id uuid)
returns public.clinic_role language sql stable security definer set search_path = '' as $$
  select role from public.clinic_members
  where clinic_id = check_clinic_id
    and user_id = (select auth.uid())
    and status = 'active'
  limit 1;
$$;

create or replace function private.can_read_patient(
  check_clinic_id uuid, check_patient_id uuid
) returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when (select auth.uid()) is null then false
    when (select private.current_clinic_role(check_clinic_id)) in
      ('owner','admin','assistant','front_desk','billing') then true
    when (select private.current_clinic_role(check_clinic_id)) in ('dentist','hygienist') then exists (
      select 1 from public.doctor_patient_assignments assignment
      where assignment.clinic_id = check_clinic_id
        and assignment.patient_id = check_patient_id
        and assignment.doctor_id = (select auth.uid())
    )
    else false
  end;
$$;

create or replace function private.can_manage_clinical_patient(
  check_clinic_id uuid, check_patient_id uuid
) returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.current_clinic_role(check_clinic_id)) in ('owner','admin')
    or (
      (select private.current_clinic_role(check_clinic_id)) in ('dentist','hygienist')
      and exists (
        select 1 from public.doctor_patient_assignments assignment
        where assignment.clinic_id = check_clinic_id
          and assignment.patient_id = check_patient_id
          and assignment.doctor_id = (select auth.uid())
      )
    );
$$;

revoke execute on function private.current_clinic_role(uuid) from public, anon;
revoke execute on function private.can_read_patient(uuid, uuid) from public, anon;
revoke execute on function private.can_manage_clinical_patient(uuid, uuid) from public, anon;
grant execute on function private.current_clinic_role(uuid) to authenticated;
grant execute on function private.can_read_patient(uuid, uuid) to authenticated;
grant execute on function private.can_manage_clinical_patient(uuid, uuid) to authenticated;

drop policy if exists doctor_patient_assignments_select on public.doctor_patient_assignments;
drop policy if exists doctor_patient_assignments_insert on public.doctor_patient_assignments;
drop policy if exists doctor_patient_assignments_delete on public.doctor_patient_assignments;
create policy doctor_patient_assignments_select on public.doctor_patient_assignments
  for select to authenticated
  using (
    doctor_id = (select auth.uid())
    or (select private.current_clinic_role(clinic_id)) in ('owner','admin','assistant','front_desk')
  );
create policy doctor_patient_assignments_insert on public.doctor_patient_assignments
  for insert to authenticated
  with check ((select private.current_clinic_role(clinic_id)) in ('owner','admin','assistant','front_desk'));
create policy doctor_patient_assignments_delete on public.doctor_patient_assignments
  for delete to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin'));

-- Replace broad clinic-member policies with patient/provider-aware policies.
drop policy if exists patients_select on public.patients;
drop policy if exists patients_insert on public.patients;
drop policy if exists patients_update on public.patients;
drop policy if exists patients_delete on public.patients;
create policy patients_select on public.patients for select to authenticated
  using ((select private.can_read_patient(clinic_id, id)));
create policy patients_insert on public.patients for insert to authenticated
  with check (
    (select private.current_clinic_role(clinic_id)) in
      ('owner','admin','dentist','hygienist','assistant','front_desk')
    and (created_by is null or created_by = (select auth.uid()))
  );
create policy patients_update on public.patients for update to authenticated
  using ((select private.can_manage_clinical_patient(clinic_id, id)))
  with check ((select private.can_manage_clinical_patient(clinic_id, id)));
create policy patients_delete on public.patients for delete to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin'));

drop policy if exists appointments_select on public.appointments;
drop policy if exists appointments_insert on public.appointments;
drop policy if exists appointments_update on public.appointments;
drop policy if exists appointments_delete on public.appointments;
create policy appointments_select on public.appointments for select to authenticated
  using (
    (select private.current_clinic_role(clinic_id)) in ('owner','admin','assistant','front_desk')
    or provider_id = (select auth.uid())
  );
create policy appointments_insert on public.appointments for insert to authenticated
  with check ((select private.current_clinic_role(clinic_id)) in ('owner','admin','assistant','front_desk'));
create policy appointments_update on public.appointments for update to authenticated
  using (
    (select private.current_clinic_role(clinic_id)) in ('owner','admin','assistant','front_desk')
    or provider_id = (select auth.uid())
  ) with check (
    (select private.current_clinic_role(clinic_id)) in ('owner','admin','assistant','front_desk')
    or provider_id = (select auth.uid())
  );
create policy appointments_delete on public.appointments for delete to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin'));

drop policy if exists dental_chart_select on public.dental_chart;
drop policy if exists dental_chart_insert on public.dental_chart;
drop policy if exists dental_chart_update on public.dental_chart;
drop policy if exists dental_chart_delete on public.dental_chart;
create policy dental_chart_select on public.dental_chart for select to authenticated
  using ((select private.can_manage_clinical_patient(clinic_id, patient_id)));
create policy dental_chart_insert on public.dental_chart for insert to authenticated
  with check ((select private.can_manage_clinical_patient(clinic_id, patient_id)));
create policy dental_chart_update on public.dental_chart for update to authenticated
  using ((select private.can_manage_clinical_patient(clinic_id, patient_id)))
  with check ((select private.can_manage_clinical_patient(clinic_id, patient_id)));
create policy dental_chart_delete on public.dental_chart for delete to authenticated
  using ((select private.can_manage_clinical_patient(clinic_id, patient_id)));

drop policy if exists dental_chart_surfaces_select on public.dental_chart_surfaces;
drop policy if exists dental_chart_surfaces_insert on public.dental_chart_surfaces;
drop policy if exists dental_chart_surfaces_update on public.dental_chart_surfaces;
drop policy if exists dental_chart_surfaces_delete on public.dental_chart_surfaces;
create policy dental_chart_surfaces_select on public.dental_chart_surfaces for select to authenticated
  using ((select private.can_manage_clinical_patient(clinic_id, patient_id)));
create policy dental_chart_surfaces_insert on public.dental_chart_surfaces for insert to authenticated
  with check ((select private.can_manage_clinical_patient(clinic_id, patient_id)));
create policy dental_chart_surfaces_update on public.dental_chart_surfaces for update to authenticated
  using ((select private.can_manage_clinical_patient(clinic_id, patient_id)))
  with check ((select private.can_manage_clinical_patient(clinic_id, patient_id)));
create policy dental_chart_surfaces_delete on public.dental_chart_surfaces for delete to authenticated
  using ((select private.can_manage_clinical_patient(clinic_id, patient_id)));

drop policy if exists treatment_plans_select on public.treatment_plans;
drop policy if exists treatment_plans_insert on public.treatment_plans;
drop policy if exists treatment_plans_update on public.treatment_plans;
drop policy if exists treatment_plans_delete on public.treatment_plans;
create policy treatment_plans_select on public.treatment_plans for select to authenticated
  using ((select private.can_manage_clinical_patient(clinic_id, patient_id)));
create policy treatment_plans_insert on public.treatment_plans for insert to authenticated
  with check ((select private.can_manage_clinical_patient(clinic_id, patient_id)));
create policy treatment_plans_update on public.treatment_plans for update to authenticated
  using ((select private.can_manage_clinical_patient(clinic_id, patient_id)))
  with check ((select private.can_manage_clinical_patient(clinic_id, patient_id)));
create policy treatment_plans_delete on public.treatment_plans for delete to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin'));

drop policy if exists treatment_plan_items_select on public.treatment_plan_items;
drop policy if exists treatment_plan_items_insert on public.treatment_plan_items;
drop policy if exists treatment_plan_items_update on public.treatment_plan_items;
drop policy if exists treatment_plan_items_delete on public.treatment_plan_items;
create policy treatment_plan_items_select on public.treatment_plan_items for select to authenticated
  using (exists (
    select 1 from public.treatment_plans plan
    where plan.id = treatment_plan_items.treatment_plan_id
      and plan.clinic_id = treatment_plan_items.clinic_id
      and (select private.can_manage_clinical_patient(treatment_plan_items.clinic_id, plan.patient_id))
  ));
create policy treatment_plan_items_insert on public.treatment_plan_items for insert to authenticated
  with check (exists (
    select 1 from public.treatment_plans plan
    where plan.id = treatment_plan_items.treatment_plan_id
      and plan.clinic_id = treatment_plan_items.clinic_id
      and (select private.can_manage_clinical_patient(treatment_plan_items.clinic_id, plan.patient_id))
  ));
create policy treatment_plan_items_update on public.treatment_plan_items for update to authenticated
  using (exists (
    select 1 from public.treatment_plans plan
    where plan.id = treatment_plan_items.treatment_plan_id
      and plan.clinic_id = treatment_plan_items.clinic_id
      and (select private.can_manage_clinical_patient(treatment_plan_items.clinic_id, plan.patient_id))
  )) with check (exists (
    select 1 from public.treatment_plans plan
    where plan.id = treatment_plan_items.treatment_plan_id
      and plan.clinic_id = treatment_plan_items.clinic_id
      and (select private.can_manage_clinical_patient(treatment_plan_items.clinic_id, plan.patient_id))
  ));
create policy treatment_plan_items_delete on public.treatment_plan_items for delete to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin','dentist','hygienist'));

drop policy if exists treatment_sessions_select on public.treatment_sessions;
drop policy if exists treatment_sessions_insert on public.treatment_sessions;
drop policy if exists treatment_sessions_update on public.treatment_sessions;
drop policy if exists treatment_sessions_delete on public.treatment_sessions;
create policy treatment_sessions_select on public.treatment_sessions for select to authenticated
  using (exists (
    select 1 from public.treatment_plan_items item
    join public.treatment_plans plan on plan.id = item.treatment_plan_id
      and plan.clinic_id = item.clinic_id
    where item.id = treatment_sessions.treatment_plan_item_id
      and item.clinic_id = treatment_sessions.clinic_id
      and (select private.can_manage_clinical_patient(treatment_sessions.clinic_id, plan.patient_id))
  ));
create policy treatment_sessions_insert on public.treatment_sessions for insert to authenticated
  with check (exists (
    select 1 from public.treatment_plan_items item
    join public.treatment_plans plan on plan.id = item.treatment_plan_id
      and plan.clinic_id = item.clinic_id
    where item.id = treatment_sessions.treatment_plan_item_id
      and item.clinic_id = treatment_sessions.clinic_id
      and (select private.can_manage_clinical_patient(treatment_sessions.clinic_id, plan.patient_id))
  ));
create policy treatment_sessions_update on public.treatment_sessions for update to authenticated
  using (exists (
    select 1 from public.treatment_plan_items item
    join public.treatment_plans plan on plan.id = item.treatment_plan_id
      and plan.clinic_id = item.clinic_id
    where item.id = treatment_sessions.treatment_plan_item_id
      and item.clinic_id = treatment_sessions.clinic_id
      and (select private.can_manage_clinical_patient(treatment_sessions.clinic_id, plan.patient_id))
  )) with check (exists (
    select 1 from public.treatment_plan_items item
    join public.treatment_plans plan on plan.id = item.treatment_plan_id
      and plan.clinic_id = item.clinic_id
    where item.id = treatment_sessions.treatment_plan_item_id
      and item.clinic_id = treatment_sessions.clinic_id
      and (select private.can_manage_clinical_patient(treatment_sessions.clinic_id, plan.patient_id))
  ));
create policy treatment_sessions_delete on public.treatment_sessions for delete to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin','dentist','hygienist'));

drop policy if exists clinical_records_select on public.clinical_records;
drop policy if exists clinical_records_insert on public.clinical_records;
drop policy if exists clinical_records_update on public.clinical_records;
drop policy if exists clinical_records_delete on public.clinical_records;
create policy clinical_records_select on public.clinical_records for select to authenticated
  using ((select private.can_manage_clinical_patient(clinic_id, patient_id)));
create policy clinical_records_insert on public.clinical_records for insert to authenticated
  with check ((select private.can_manage_clinical_patient(clinic_id, patient_id)) and author_id = (select auth.uid()));
create policy clinical_records_update on public.clinical_records for update to authenticated
  using ((select private.can_manage_clinical_patient(clinic_id, patient_id)))
  with check ((select private.can_manage_clinical_patient(clinic_id, patient_id)));
create policy clinical_records_delete on public.clinical_records for delete to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin'));

drop policy if exists procedure_catalog_insert on public.procedure_catalog;
drop policy if exists procedure_catalog_update on public.procedure_catalog;
drop policy if exists procedure_catalog_delete on public.procedure_catalog;
create policy procedure_catalog_insert on public.procedure_catalog for insert to authenticated
  with check ((select private.current_clinic_role(clinic_id)) in ('owner','admin'));
create policy procedure_catalog_update on public.procedure_catalog for update to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin'))
  with check ((select private.current_clinic_role(clinic_id)) in ('owner','admin'));
create policy procedure_catalog_delete on public.procedure_catalog for delete to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin'));

-- Financial rows are operationally available to reception/billing, while the
-- UI keeps aggregate revenue/profit reporting admin-only.
drop policy if exists invoices_select on public.invoices;
drop policy if exists invoices_insert on public.invoices;
drop policy if exists invoices_update on public.invoices;
drop policy if exists invoices_delete on public.invoices;
create policy invoices_select on public.invoices for select to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin','billing','front_desk','assistant'));
create policy invoices_insert on public.invoices for insert to authenticated
  with check ((select private.current_clinic_role(clinic_id)) in ('owner','admin','billing','front_desk','assistant'));
create policy invoices_update on public.invoices for update to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin','billing'))
  with check ((select private.current_clinic_role(clinic_id)) in ('owner','admin','billing'));
create policy invoices_delete on public.invoices for delete to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin'));

drop policy if exists payments_select on public.payments;
drop policy if exists payments_insert on public.payments;
drop policy if exists payments_update on public.payments;
drop policy if exists payments_delete on public.payments;
create policy payments_select on public.payments for select to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin','billing','front_desk','assistant'));
create policy payments_insert on public.payments for insert to authenticated
  with check ((select private.current_clinic_role(clinic_id)) in ('owner','admin','billing','front_desk','assistant'));
create policy payments_update on public.payments for update to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin','billing'))
  with check ((select private.current_clinic_role(clinic_id)) in ('owner','admin','billing'));
create policy payments_delete on public.payments for delete to authenticated
  using ((select private.current_clinic_role(clinic_id)) in ('owner','admin'));

create or replace function public.create_appointment_with_invoice(
  p_clinic_id uuid,
  p_appointment_id uuid,
  p_patient_id uuid,
  p_provider_id uuid,
  p_procedure_id uuid,
  p_treatment_name text,
  p_treatment_price numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_room text,
  p_color text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  provider_name text;
  resolved_name text;
  resolved_price numeric(12,2);
  new_invoice_id uuid;
begin
  if not (select private.has_clinic_role(
    p_clinic_id, array['owner','admin','assistant','front_desk']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  if p_ends_at <= p_starts_at then raise exception 'Appointment end must follow its start'; end if;
  if not exists (select 1 from public.patients where id = p_patient_id and clinic_id = p_clinic_id)
    then raise exception 'Patient not found'; end if;
  select full_name into provider_name from public.clinic_members
  where clinic_id = p_clinic_id and user_id = p_provider_id and status = 'active'
    and role in ('dentist','hygienist');
  if provider_name is null then raise exception 'Assigned doctor is unavailable'; end if;

  if p_procedure_id is not null then
    select name, default_price into resolved_name, resolved_price
    from public.procedure_catalog
    where id = p_procedure_id and clinic_id = p_clinic_id and is_active;
  else
    resolved_name := nullif(trim(p_treatment_name), '');
    resolved_price := p_treatment_price;
  end if;
  if resolved_name is null or resolved_price is null or resolved_price < 0
    then raise exception 'A valid treatment and price are required'; end if;

  insert into public.appointments
    (id, clinic_id, patient_id, provider_id, doctor_name, procedure_id,
     title, treatment_price, starts_at, ends_at, room, status, color, created_by)
  values
    (p_appointment_id, p_clinic_id, p_patient_id, p_provider_id, provider_name,
     p_procedure_id, resolved_name, resolved_price, p_starts_at, p_ends_at,
     nullif(trim(p_room), ''), 'Confirmed', coalesce(nullif(p_color, ''), '#0f9f8f'),
     (select auth.uid()));

  insert into public.doctor_patient_assignments
    (clinic_id, doctor_id, patient_id, assigned_by)
  values (p_clinic_id, p_provider_id, p_patient_id, (select auth.uid()))
  on conflict do nothing;

  insert into public.invoices
    (clinic_id, patient_id, appointment_id, invoice_number, treatment_name,
     original_price, subtotal, total_amount, status)
  values
    (p_clinic_id, p_patient_id, p_appointment_id,
     'APT-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(replace(p_appointment_id::text, '-', ''), 1, 8)),
     resolved_name, resolved_price, resolved_price, resolved_price,
     case when resolved_price = 0 then 'paid' else 'open' end)
  returning id into new_invoice_id;

  update public.patients patient set outstanding_balance = (
    select coalesce(sum(greatest(invoice.total_amount - invoice.discount_amount
      - coalesce((select sum(payment.amount) from public.payments payment
        where payment.invoice_id = invoice.id and payment.clinic_id = invoice.clinic_id), 0), 0)), 0)
    from public.invoices invoice
    where invoice.clinic_id = p_clinic_id and invoice.patient_id = p_patient_id
      and invoice.status <> 'void'
  ) where patient.id = p_patient_id and patient.clinic_id = p_clinic_id;
  return new_invoice_id;
end;
$$;
revoke all on function public.create_appointment_with_invoice(uuid, uuid, uuid, uuid, uuid, text, numeric, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.create_appointment_with_invoice(uuid, uuid, uuid, uuid, uuid, text, numeric, timestamptz, timestamptz, text, text) to authenticated;

create or replace function public.reschedule_appointment(
  p_clinic_id uuid, p_appointment_id uuid,
  p_starts_at timestamptz, p_ends_at timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare target public.appointments%rowtype;
begin
  if p_ends_at <= p_starts_at then raise exception 'Appointment end must follow its start'; end if;
  if p_starts_at < now() then raise exception 'Appointments cannot be moved into the past'; end if;
  select * into target from public.appointments
  where id = p_appointment_id and clinic_id = p_clinic_id for update;
  if target.id is null then raise exception 'Appointment not found'; end if;
  if not ((select private.current_clinic_role(p_clinic_id)) in ('owner','admin','assistant','front_desk')
    or target.provider_id = (select auth.uid())) then raise exception 'Insufficient clinic permission'; end if;
  if target.status in ('Completed','Cancelled') then
    raise exception 'Completed or cancelled appointments cannot be moved';
  end if;
  update public.appointments set starts_at = p_starts_at, ends_at = p_ends_at
  where id = target.id and clinic_id = p_clinic_id;
  update public.treatment_sessions set scheduled_at = p_starts_at
  where clinic_id = p_clinic_id and appointment_id = target.id and status <> 'completed';
  return true;
end;
$$;

create or replace function public.record_appointment_payment(
  p_clinic_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  invoice_row public.invoices%rowtype;
  collected numeric(12,2);
  remaining numeric(12,2);
  new_payment_id uuid;
  new_receipt_number text;
  clinic_info jsonb;
begin
  if not (select private.has_clinic_role(
    p_clinic_id, array['owner','admin','billing','front_desk','assistant']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  if p_method not in ('Card','Cash','Insurance','Bank transfer')
    then raise exception 'Invalid payment method'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_invoice_id::text, 0));
  select * into invoice_row from public.invoices
  where id = p_invoice_id and clinic_id = p_clinic_id and status <> 'void' for update;
  if invoice_row.id is null then raise exception 'Invoice not found'; end if;
  select coalesce(sum(amount), 0) into collected from public.payments
  where clinic_id = p_clinic_id and invoice_id = p_invoice_id;
  remaining := greatest(invoice_row.total_amount - invoice_row.discount_amount - collected, 0);
  if p_amount is null or p_amount <= 0 or p_amount > remaining
    then raise exception 'Payment must be greater than zero and no more than the remaining balance'; end if;
  new_receipt_number := 'RCT-' || to_char(current_date, 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  select jsonb_build_object('name', name, 'phone', phone, 'email', email,
    'address', address, 'currency', currency) into clinic_info
  from public.clinics where id = p_clinic_id;
  insert into public.payments
    (clinic_id, invoice_id, amount, method, reference, recorded_by,
     receipt_number, treatment_name_snapshot, original_price_snapshot,
     amount_due_snapshot, remaining_balance_snapshot, clinic_snapshot)
  values
    (p_clinic_id, p_invoice_id, p_amount, p_method, nullif(trim(p_reference), ''),
     (select auth.uid()), new_receipt_number, invoice_row.treatment_name,
     invoice_row.original_price, invoice_row.total_amount - invoice_row.discount_amount,
     greatest(remaining - p_amount, 0), clinic_info)
  returning id into new_payment_id;
  update public.invoices set status = case when p_amount >= remaining then 'paid' else 'partial' end
  where id = p_invoice_id;
  update public.patients patient set outstanding_balance = (
    select coalesce(sum(greatest(invoice.total_amount - invoice.discount_amount
      - coalesce((select sum(payment.amount) from public.payments payment
        where payment.invoice_id = invoice.id and payment.clinic_id = invoice.clinic_id), 0), 0)), 0)
    from public.invoices invoice
    where invoice.clinic_id = p_clinic_id and invoice.patient_id = invoice_row.patient_id
      and invoice.status <> 'void'
  ) where patient.id = invoice_row.patient_id and patient.clinic_id = p_clinic_id;
  return new_payment_id;
end;
$$;
revoke all on function public.record_appointment_payment(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.record_appointment_payment(uuid, uuid, numeric, text, text) to authenticated;

grant select, insert, update on public.appointments, public.invoices, public.payments to authenticated;
alter publication supabase_realtime add table public.invoices,
  public.doctor_patient_assignments, public.procedure_catalog;
