-- Clinic hardening: additive, forward-only changes for financial integrity,
-- least-privilege table access, and tenant-safe administration.
-- Earlier migrations are not edited. Signatures of existing RPCs are unchanged.

-- ---------------------------------------------------------------------------
-- 1. Payment reversals
-- ---------------------------------------------------------------------------
-- A payment is never deleted or edited. A reversal records who reversed it,
-- when, and why, and every balance is recalculated from the remaining payments.
alter table public.payments
  add column reversed_at timestamptz,
  add column reversed_by uuid references auth.users(id),
  add column reversal_reason text,
  add constraint payments_reversal_consistent_check check (
    (reversed_at is null and reversed_by is null and reversal_reason is null)
    or (reversed_at is not null and reversed_by is not null
      and nullif(btrim(reversal_reason), '') is not null)
  ),
  add constraint payments_reversal_reason_length_check check (
    reversal_reason is null or char_length(reversal_reason) <= 500
  );
create index if not exists payments_reversed_by_fk_idx on public.payments (reversed_by);

-- ---------------------------------------------------------------------------
-- 2. Private balance helpers (single source of truth for invoice status,
--    treatment-item collected totals, and patient balances)
-- ---------------------------------------------------------------------------
-- Balance = sum over non-void invoices of max(total - discount - active payments, 0).
-- Reversed payments are excluded everywhere.

create function private.recalculate_invoice_status(target_invoice_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  invoice_row public.invoices%rowtype;
  active_collected numeric(12,2);
  net_due numeric(12,2);
begin
  select * into invoice_row from public.invoices where id = target_invoice_id for update;
  if invoice_row.id is null or invoice_row.status = 'void' then return; end if;
  select coalesce(sum(payment.amount), 0) into active_collected
  from public.payments payment
  where payment.invoice_id = invoice_row.id
    and payment.clinic_id = invoice_row.clinic_id
    and payment.reversed_at is null;
  net_due := greatest(invoice_row.total_amount - invoice_row.discount_amount, 0);
  update public.invoices set status = case
      when active_collected >= net_due then 'paid'
      when active_collected > 0 then 'partial'
      else 'open'
    end
  where id = invoice_row.id;
end;
$$;

create function private.recalculate_patient_balance(target_clinic_id uuid, target_patient_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  patient_balance numeric(12,2);
begin
  select coalesce(sum(greatest(
      invoice.total_amount - invoice.discount_amount - coalesce(collected.amount, 0), 0)), 0)
    into patient_balance
  from public.invoices invoice
  left join lateral (
    select sum(payment.amount) as amount
    from public.payments payment
    where payment.invoice_id = invoice.id
      and payment.clinic_id = invoice.clinic_id
      and payment.reversed_at is null
  ) collected on true
  where invoice.clinic_id = target_clinic_id
    and invoice.patient_id = target_patient_id
    and invoice.status <> 'void';
  update public.patients set outstanding_balance = greatest(patient_balance, 0)
  where id = target_patient_id and clinic_id = target_clinic_id;
end;
$$;

create function private.refresh_treatment_item_amount_paid(target_clinic_id uuid, target_item_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.treatment_plan_items item set amount_paid = (
    select coalesce(sum(allocation.amount), 0)
    from public.treatment_item_payments allocation
    join public.payments payment
      on payment.id = allocation.payment_id and payment.clinic_id = allocation.clinic_id
    where allocation.clinic_id = target_clinic_id
      and allocation.treatment_plan_item_id = target_item_id
      and payment.reversed_at is null
  )
  where item.id = target_item_id and item.clinic_id = target_clinic_id;
end;
$$;

revoke all on function private.recalculate_invoice_status(uuid) from public, anon, authenticated;
revoke all on function private.recalculate_patient_balance(uuid, uuid) from public, anon, authenticated;
revoke all on function private.refresh_treatment_item_amount_paid(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Payment-recording RPCs: discount-aware balances, reversed payments excluded,
--    session payments limited to finance roles (dentists removed).
-- ---------------------------------------------------------------------------
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
  if p_method is null or p_method not in ('Card','Cash','Insurance','Bank transfer')
    then raise exception 'Invalid payment method'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_invoice_id::text, 0));
  select * into invoice_row from public.invoices
  where id = p_invoice_id and clinic_id = p_clinic_id and status <> 'void' for update;
  if invoice_row.id is null then raise exception 'Invoice not found'; end if;
  select coalesce(sum(payment.amount), 0) into collected from public.payments payment
  where payment.clinic_id = p_clinic_id and payment.invoice_id = p_invoice_id
    and payment.reversed_at is null;
  remaining := greatest(invoice_row.total_amount - invoice_row.discount_amount - collected, 0);
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) or p_amount > remaining
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
  perform private.recalculate_invoice_status(p_invoice_id);
  perform private.recalculate_patient_balance(p_clinic_id, invoice_row.patient_id);
  return new_payment_id;
end;
$$;

create or replace function public.record_session_payment(
  p_clinic_id uuid,
  p_session_id uuid,
  p_payment_mode text,
  p_amount numeric,
  p_method text,
  p_reference text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  session_row public.treatment_sessions%rowtype;
  item_row public.treatment_plan_items%rowtype;
  plan_row public.treatment_plans%rowtype;
  target_invoice_id uuid;
  new_payment_id uuid;
  already_paid numeric(12,2);
  amount_to_collect numeric(12,2);
  expected numeric(12,2);
begin
  if not (select private.has_clinic_role(
    p_clinic_id, array['owner','admin','billing','front_desk','assistant']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  if p_payment_mode = 'not_paid' then return null; end if;
  if p_payment_mode is null or p_payment_mode not in ('full','partial')
    then raise exception 'Invalid payment mode'; end if;
  if p_method is null or p_method not in ('Card','Cash','Insurance','Bank transfer')
    then raise exception 'Invalid payment method'; end if;

  select * into session_row from public.treatment_sessions
  where id = p_session_id and clinic_id = p_clinic_id for update;
  if session_row.id is null or session_row.status = 'cancelled'
    then raise exception 'Session is unavailable'; end if;
  select * into item_row from public.treatment_plan_items
  where id = session_row.treatment_plan_item_id and clinic_id = p_clinic_id for update;
  select * into plan_row from public.treatment_plans
  where id = item_row.treatment_plan_id and clinic_id = p_clinic_id;
  if plan_row.id is null then raise exception 'Treatment plan not found'; end if;

  expected := session_row.expected_amount;
  select coalesce(sum(allocation.amount), 0) into already_paid
  from public.treatment_item_payments allocation
  join public.payments payment
    on payment.id = allocation.payment_id and payment.clinic_id = allocation.clinic_id
  where allocation.clinic_id = p_clinic_id
    and allocation.treatment_session_id = session_row.id
    and payment.reversed_at is null;
  if already_paid >= expected then raise exception 'This session is already fully paid'; end if;

  if p_payment_mode = 'partial' and (p_amount is null or p_amount <> round(p_amount, 2)) then
    raise exception 'Payment must be greater than zero and no more than the session balance';
  end if;
  amount_to_collect := case when p_payment_mode = 'full' then expected - already_paid else p_amount end;
  if amount_to_collect is null or amount_to_collect <= 0 or amount_to_collect > expected - already_paid then
    raise exception 'Payment must be greater than zero and no more than the session balance';
  end if;

  select id into target_invoice_id from public.invoices
  where clinic_id = p_clinic_id and treatment_session_id = session_row.id and status <> 'void'
  for update;
  if target_invoice_id is null then
    insert into public.invoices
      (clinic_id, patient_id, treatment_plan_id, treatment_session_id, invoice_number,
       subtotal, discount_amount, total_amount, status)
    values
      (p_clinic_id, plan_row.patient_id, plan_row.id, session_row.id,
       'SES-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(replace(session_row.id::text, '-', ''), 1, 8)),
       expected, 0, expected, 'open')
    returning id into target_invoice_id;
  end if;

  insert into public.payments (clinic_id, invoice_id, amount, method, reference, recorded_by)
  values (p_clinic_id, target_invoice_id, amount_to_collect, p_method,
    nullif(trim(p_reference), ''), (select auth.uid()))
  returning id into new_payment_id;
  insert into public.treatment_item_payments
    (clinic_id, treatment_plan_item_id, treatment_session_id, payment_id, amount)
  values (p_clinic_id, item_row.id, session_row.id, new_payment_id, amount_to_collect);

  perform private.refresh_treatment_item_amount_paid(p_clinic_id, item_row.id);
  perform private.recalculate_invoice_status(target_invoice_id);
  perform private.recalculate_patient_balance(p_clinic_id, plan_row.patient_id);
  return new_payment_id;
end;
$$;
revoke all on function public.record_session_payment(uuid, uuid, text, numeric, text, text) from public, anon;
grant execute on function public.record_session_payment(uuid, uuid, text, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Reverse a payment (owner, admin, billing). Clinical completion is untouched.
-- ---------------------------------------------------------------------------
create function public.reverse_payment(p_clinic_id uuid, p_payment_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  target_invoice_id uuid;
  target_patient_id uuid;
  cleaned_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  affected_item_id uuid;
  payment_row public.payments%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.has_clinic_role(
    p_clinic_id, array['owner','admin','billing']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  if cleaned_reason is null then raise exception 'A reversal reason is required'; end if;
  if char_length(cleaned_reason) > 500
    then raise exception 'Reversal reason must be 500 characters or fewer'; end if;

  select payment.invoice_id into target_invoice_id from public.payments payment
  where payment.id = p_payment_id and payment.clinic_id = p_clinic_id;
  if target_invoice_id is null then raise exception 'Payment not found'; end if;

  -- Same lock order as recording a payment: invoice first, then the payment row.
  perform pg_advisory_xact_lock(hashtextextended(target_invoice_id::text, 0));
  select invoice.patient_id into target_patient_id from public.invoices invoice
  where invoice.id = target_invoice_id and invoice.clinic_id = p_clinic_id for update;
  select * into payment_row from public.payments
  where id = p_payment_id and clinic_id = p_clinic_id for update;
  if payment_row.id is null then raise exception 'Payment not found'; end if;
  if payment_row.reversed_at is not null
    then raise exception 'This payment has already been reversed'; end if;

  update public.payments set
    reversed_at = now(),
    reversed_by = (select auth.uid()),
    reversal_reason = cleaned_reason
  where id = p_payment_id and clinic_id = p_clinic_id;

  for affected_item_id in
    select distinct allocation.treatment_plan_item_id
    from public.treatment_item_payments allocation
    where allocation.payment_id = p_payment_id and allocation.clinic_id = p_clinic_id
  loop
    perform private.refresh_treatment_item_amount_paid(p_clinic_id, affected_item_id);
  end loop;

  perform private.recalculate_invoice_status(target_invoice_id);
  perform private.recalculate_patient_balance(p_clinic_id, target_patient_id);
  return true;
end;
$$;
revoke all on function public.reverse_payment(uuid, uuid, text) from public, anon;
grant execute on function public.reverse_payment(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Inventory: stock changes only through movements
-- ---------------------------------------------------------------------------
create function public.create_inventory_item(
  p_clinic_id uuid,
  p_name text,
  p_category text,
  p_sku text,
  p_quantity numeric,
  p_reorder_level numeric,
  p_unit text,
  p_supplier text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_item_id uuid;
  cleaned_name text := nullif(btrim(coalesce(p_name, '')), '');
  cleaned_category text := nullif(btrim(coalesce(p_category, '')), '');
  cleaned_sku text := nullif(btrim(coalesce(p_sku, '')), '');
  cleaned_unit text := coalesce(nullif(btrim(coalesce(p_unit, '')), ''), 'units');
  cleaned_supplier text := nullif(btrim(coalesce(p_supplier, '')), '');
  opening_quantity numeric(12,2) := coalesce(p_quantity, 0);
  reorder_quantity numeric(12,2) := coalesce(p_reorder_level, 0);
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.has_clinic_role(
    p_clinic_id, array['owner','admin','assistant']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  if cleaned_name is null or char_length(cleaned_name) > 200
    then raise exception 'Item name is required (200 characters or fewer)'; end if;
  if cleaned_category is null or char_length(cleaned_category) > 100
    then raise exception 'Item category is required (100 characters or fewer)'; end if;
  if cleaned_sku is null or char_length(cleaned_sku) > 64
    then raise exception 'SKU is required (64 characters or fewer)'; end if;
  if char_length(cleaned_unit) > 32 then raise exception 'Unit must be 32 characters or fewer'; end if;
  if cleaned_supplier is not null and char_length(cleaned_supplier) > 200
    then raise exception 'Supplier must be 200 characters or fewer'; end if;
  -- Validate the raw inputs: the numeric(12,2) variables would round silently.
  if coalesce(p_quantity, 0) < 0 or coalesce(p_quantity, 0) >= 10000000000
    or coalesce(p_quantity, 0) <> round(coalesce(p_quantity, 0), 2)
    then raise exception 'Opening quantity must be zero or positive with at most two decimal places'; end if;
  if coalesce(p_reorder_level, 0) < 0 or coalesce(p_reorder_level, 0) >= 10000000000
    or coalesce(p_reorder_level, 0) <> round(coalesce(p_reorder_level, 0), 2)
    then raise exception 'Reorder level must be zero or positive with at most two decimal places'; end if;
  if exists (select 1 from public.inventory_items item
    where item.clinic_id = p_clinic_id and item.sku = cleaned_sku)
    then raise exception 'An inventory item with this SKU already exists'; end if;

  insert into public.inventory_items
    (clinic_id, name, category, sku, quantity, reorder_level, unit, supplier)
  values
    (p_clinic_id, cleaned_name, cleaned_category, cleaned_sku, opening_quantity,
     reorder_quantity, cleaned_unit, cleaned_supplier)
  returning id into new_item_id;

  if opening_quantity > 0 then
    insert into public.inventory_movements
      (clinic_id, inventory_item_id, quantity_delta, reason, recorded_by)
    values (p_clinic_id, new_item_id, opening_quantity, 'Opening stock', (select auth.uid()));
  end if;
  return new_item_id;
end;
$$;
revoke all on function public.create_inventory_item(uuid, text, text, text, numeric, numeric, text, text) from public, anon;
grant execute on function public.create_inventory_item(uuid, text, text, text, numeric, numeric, text, text) to authenticated;

create function public.adjust_inventory_stock(
  p_clinic_id uuid,
  p_item_id uuid,
  p_delta numeric,
  p_reason text
) returns numeric language plpgsql security definer set search_path = '' as $$
declare
  current_stock numeric(12,2);
  updated_stock numeric(12,2);
  cleaned_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.has_clinic_role(
    p_clinic_id, array['owner','admin','assistant']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) >= 10000000000 or p_delta <> round(p_delta, 2)
    then raise exception 'Stock adjustment must be a non-zero amount with at most two decimal places'; end if;
  if cleaned_reason is null then raise exception 'A stock adjustment reason is required'; end if;
  if char_length(cleaned_reason) > 500
    then raise exception 'Stock adjustment reason must be 500 characters or fewer'; end if;

  select item.quantity into current_stock from public.inventory_items item
  where item.id = p_item_id and item.clinic_id = p_clinic_id for update;
  if not found then raise exception 'Inventory item not found'; end if;
  updated_stock := current_stock + p_delta;
  if updated_stock < 0 then raise exception 'Stock cannot go below zero'; end if;

  update public.inventory_items set quantity = updated_stock
  where id = p_item_id and clinic_id = p_clinic_id;
  insert into public.inventory_movements
    (clinic_id, inventory_item_id, quantity_delta, reason, recorded_by)
  values (p_clinic_id, p_item_id, p_delta, cleaned_reason, (select auth.uid()));
  return updated_stock;
end;
$$;
revoke all on function public.adjust_inventory_stock(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.adjust_inventory_stock(uuid, uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Patients: balance is derived, never written by clients; create and update
--    share one RPC. The update path never changes the balance.
-- ---------------------------------------------------------------------------
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
  p_outstanding_balance numeric default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role public.clinic_role;
  normalized_name text := trim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  normalized_number text := trim(coalesce(p_patient_number, ''));
  normalized_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  resolved_first_name text;
  resolved_last_name text;
  updated_rows integer;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if p_patient_id is null then raise exception 'Patient id is required'; end if;

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
  if normalized_number = '' then raise exception 'Patient number is required'; end if;
  if p_phone is null or p_phone !~ '^\+9647[0-9]{9}$' then
    raise exception 'Enter a valid Iraqi mobile number (07XXXXXXXXX or +9647XXXXXXXXX)';
  end if;
  if normalized_email is not null
    and normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if p_gender is null or p_gender not in ('Female','Male','Other') then raise exception 'Invalid gender'; end if;
  if p_status is null or p_status not in ('active','inactive') then raise exception 'Invalid patient status'; end if;
  if p_date_of_birth is not null and p_date_of_birth > current_date
    then raise exception 'Date of birth cannot be in the future'; end if;
  -- p_outstanding_balance is accepted for signature compatibility and ignored:
  -- balances are derived from invoices and payments, never from client input.

  resolved_first_name := split_part(normalized_name, ' ', 1);
  resolved_last_name := regexp_replace(normalized_name, '^\S+\s*', '');

  -- Update path: an existing patient in this clinic. Balance columns are untouched.
  update public.patients set
    patient_number = normalized_number,
    first_name = resolved_first_name,
    last_name = resolved_last_name,
    date_of_birth = p_date_of_birth,
    gender = p_gender,
    phone = p_phone,
    email = normalized_email,
    allergies = coalesce(p_allergies, '{}'),
    medical_conditions = coalesce(p_medical_conditions, '{}'),
    notes = coalesce(p_notes, ''),
    status = p_status
  where id = p_patient_id and clinic_id = p_clinic_id;
  get diagnostics updated_rows = row_count;
  if updated_rows > 0 then return p_patient_id; end if;

  -- The patient is visible to the caller but not editable by their role.
  if exists (select 1 from public.patients where id = p_patient_id) then
    raise exception 'Insufficient clinic permission';
  end if;

  -- Create path. outstanding_balance is not listed, so it is always 0.
  insert into public.patients (
    id, clinic_id, patient_number, first_name, last_name, date_of_birth,
    gender, phone, email, allergies, medical_conditions, notes, status, created_by
  ) values (
    p_patient_id, p_clinic_id, normalized_number, resolved_first_name,
    resolved_last_name, p_date_of_birth, p_gender, p_phone, normalized_email,
    coalesce(p_allergies, '{}'), coalesce(p_medical_conditions, '{}'),
    coalesce(p_notes, ''), p_status, caller_id
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

-- ---------------------------------------------------------------------------
-- 7. Appointment invoices recalculate balances through the shared helper, so
--    reversed payments are excluded. The invoker variant becomes a definer:
--    it still enforces the same role checks, but no longer needs column UPDATE
--    on patients.outstanding_balance.
-- ---------------------------------------------------------------------------
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

  perform private.recalculate_patient_balance(p_clinic_id, p_patient_id);
  return new_invoice_id;
end;
$$;

create or replace function public.create_appointment_with_invoice_for_member(
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
) returns uuid language plpgsql security definer set search_path = '' as $$
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

  perform private.recalculate_patient_balance(p_clinic_id, p_patient_id);
  return new_invoice_id;
end;
$$;

revoke all on function public.create_appointment_with_invoice_for_member(
  uuid, uuid, uuid, uuid, uuid, text, numeric, timestamptz, timestamptz, text, text
) from public, anon;
grant execute on function public.create_appointment_with_invoice_for_member(
  uuid, uuid, uuid, uuid, uuid, text, numeric, timestamptz, timestamptz, text, text
) to authenticated;

-- Legacy direct-insert helper: it wrote invoices and payments as the caller and
-- could bypass the overpayment check. Nothing in the application calls it.
revoke all on function public.record_clinic_payment(uuid, uuid, text, numeric, numeric, numeric, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Privileges and policies
-- ---------------------------------------------------------------------------

-- Payments are append-only through the payment RPCs: no client UPDATE, DELETE,
-- or direct INSERT (which would bypass the overpayment and duplicate checks).
drop policy if exists payments_insert on public.payments;
drop policy if exists payments_update on public.payments;
drop policy if exists payments_delete on public.payments;
revoke insert, update, delete on public.payments from authenticated;

-- patients: balances are never client-writable. Columns are granted explicitly.
revoke insert, update on public.patients from authenticated;
grant insert (
  id, clinic_id, created_by, patient_number, first_name, last_name, date_of_birth,
  gender, phone, email, address, emergency_contact, allergies, medical_conditions,
  medications, notes, status, last_visit_at
) on public.patients to authenticated;
grant update (
  patient_number, first_name, last_name, date_of_birth, gender, phone, email,
  address, emergency_contact, allergies, medical_conditions, medications, notes,
  status, last_visit_at
) on public.patients to authenticated;

-- inventory_items: quantity changes only through adjust_inventory_stock and
-- create_inventory_item, which both write an inventory_movements row.
revoke insert, update on public.inventory_items from authenticated;
grant insert (
  clinic_id, name, category, sku, reorder_level, unit, supplier, unit_cost, expires_at
) on public.inventory_items to authenticated;
grant update (
  name, category, sku, reorder_level, unit, supplier, unit_cost, expires_at
) on public.inventory_items to authenticated;

-- inventory_movements is an audit log written only by the stock RPCs.
drop policy if exists inventory_movements_insert on public.inventory_movements;
drop policy if exists inventory_movements_update on public.inventory_movements;
drop policy if exists inventory_movements_delete on public.inventory_movements;
revoke insert, update, delete on public.inventory_movements from authenticated;

-- Staff: admins manage staff but cannot touch owner rows or create owners.
drop policy if exists members_insert on public.clinic_members;
create policy members_insert on public.clinic_members for insert to authenticated
  with check (
    (select private.has_clinic_role(clinic_id, array['owner']::public.clinic_role[]))
    or (
      (select private.has_clinic_role(clinic_id, array['admin']::public.clinic_role[]))
      and role <> 'owner'
    )
  );
drop policy if exists members_update on public.clinic_members;
create policy members_update on public.clinic_members for update to authenticated
  using (
    (select private.has_clinic_role(clinic_id, array['owner']::public.clinic_role[]))
    or (
      (select private.has_clinic_role(clinic_id, array['admin']::public.clinic_role[]))
      and role <> 'owner'
    )
  )
  with check (
    (select private.has_clinic_role(clinic_id, array['owner']::public.clinic_role[]))
    or (
      (select private.has_clinic_role(clinic_id, array['admin']::public.clinic_role[]))
      and role <> 'owner'
    )
  );

-- System price-list procedures cannot be deleted, and their system flag cannot
-- be changed to make them deletable.
drop policy if exists procedure_catalog_delete on public.procedure_catalog;
create policy procedure_catalog_delete on public.procedure_catalog for delete to authenticated
  using (
    (select private.current_clinic_role(clinic_id)) in ('owner','admin')
    and not is_system
  );

create function private.protect_procedure_system_flag()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.is_system is distinct from old.is_system then
    raise exception 'The system flag of a price-list procedure cannot be changed';
  end if;
  return new;
end;
$$;
create trigger protect_procedure_system_flag_before_update
  before update on public.procedure_catalog
  for each row execute function private.protect_procedure_system_flag();

-- ---------------------------------------------------------------------------
-- 9. Explicit grants for new RPCs
-- ---------------------------------------------------------------------------
-- reverse_payment, adjust_inventory_stock, and create_inventory_item are granted
-- above, next to their definitions. Helpers in private are internal only.

-- ---------------------------------------------------------------------------
-- 10. Clinic timezone default. Existing rows are intentionally left unchanged.
-- ---------------------------------------------------------------------------
alter table public.clinics alter column timezone set default 'Asia/Baghdad';

do $$
declare
  legacy_rows integer;
begin
  select count(*) into legacy_rows from public.clinics where timezone = 'America/Los_Angeles';
  raise notice 'clinics.timezone now defaults to Asia/Baghdad. % existing clinic row(s) still use America/Los_Angeles and were left unchanged.', legacy_rows;
end;
$$;
