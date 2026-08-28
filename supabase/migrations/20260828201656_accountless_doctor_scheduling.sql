-- Appointments reference the clinic staff record independently of whether that
-- staff member also owns an authentication account.
alter table public.clinic_members
  add constraint clinic_members_id_clinic_unique unique (id, clinic_id);

alter table public.appointments
  add column provider_member_id uuid;

update public.appointments appointment
set provider_member_id = member.id
from public.clinic_members member
where member.clinic_id = appointment.clinic_id
  and member.user_id = appointment.provider_id
  and appointment.provider_member_id is null;

alter table public.appointments
  add constraint appointments_provider_member_clinic_fkey
  foreign key (provider_member_id, clinic_id)
  references public.clinic_members (id, clinic_id)
  on delete restrict;

create index appointments_clinic_provider_member_idx
  on public.appointments (clinic_id, provider_member_id);

create function public.create_appointment_with_invoice_for_member(
  p_clinic_id uuid,
  p_appointment_id uuid,
  p_patient_id uuid,
  p_provider_member_id uuid,
  p_procedure_id uuid,
  p_treatment_name text,
  p_treatment_price numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_room text,
  p_color text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  provider_name text;
  provider_user_id uuid;
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

  select full_name, user_id into provider_name, provider_user_id
  from public.clinic_members
  where id = p_provider_member_id and clinic_id = p_clinic_id and status = 'active'
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
    (id, clinic_id, patient_id, provider_id, provider_member_id, doctor_name,
     procedure_id, title, treatment_price, starts_at, ends_at, room, status,
     color, created_by)
  values
    (p_appointment_id, p_clinic_id, p_patient_id, provider_user_id,
     p_provider_member_id, provider_name, p_procedure_id, resolved_name,
     resolved_price, p_starts_at, p_ends_at, nullif(trim(p_room), ''),
     'Confirmed', coalesce(nullif(p_color, ''), '#0f9f8f'), (select auth.uid()));

  if provider_user_id is not null then
    insert into public.doctor_patient_assignments
      (clinic_id, doctor_id, patient_id, assigned_by)
    values (p_clinic_id, provider_user_id, p_patient_id, (select auth.uid()))
    on conflict do nothing;
  end if;

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

revoke all on function public.create_appointment_with_invoice_for_member(
  uuid, uuid, uuid, uuid, uuid, text, numeric, timestamptz, timestamptz, text, text
) from public, anon;
grant execute on function public.create_appointment_with_invoice_for_member(
  uuid, uuid, uuid, uuid, uuid, text, numeric, timestamptz, timestamptz, text, text
) to authenticated;

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
  if exists (
    select 1 from public.appointments other
    where other.clinic_id = p_clinic_id and other.id <> target.id
      and other.status not in ('Completed','Cancelled')
      and tstzrange(other.starts_at, other.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      and ((target.provider_member_id is not null and other.provider_member_id = target.provider_member_id)
        or (target.provider_member_id is null and target.provider_id is not null and other.provider_id = target.provider_id)
        or (target.provider_member_id is null and target.provider_id is null and target.doctor_name is not null
          and target.doctor_name <> '' and other.doctor_name = target.doctor_name)
        or (target.room is not null and target.room <> '' and other.room = target.room))
  ) then raise exception 'The provider or room is already booked at that time'; end if;

  update public.appointments set starts_at = p_starts_at, ends_at = p_ends_at
  where id = target.id and clinic_id = p_clinic_id;
  update public.treatment_sessions set scheduled_at = p_starts_at
  where clinic_id = p_clinic_id and appointment_id = target.id and status <> 'completed';
  return true;
end;
$$;
