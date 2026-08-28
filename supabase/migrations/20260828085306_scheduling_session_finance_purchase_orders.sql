-- Additive scheduling, session-finance, and purchasing extensions.
-- No inventory movement is created by a purchase order.

alter table public.treatment_sessions
  add column expected_amount numeric(12,2) not null default 0 check (expected_amount >= 0),
  add constraint treatment_sessions_id_clinic_unique unique (id, clinic_id);

alter table public.treatment_plans
  add column quoted_total_amount numeric(12,2) check (quoted_total_amount is null or quoted_total_amount >= 0);

update public.treatment_sessions session set expected_amount = case
  when session.session_number = item.sessions_total then
    greatest(item.price * item.quantity - item.discount_amount, 0)
      - round(greatest(item.price * item.quantity - item.discount_amount, 0) / item.sessions_total, 2) * (item.sessions_total - 1)
  else round(greatest(item.price * item.quantity - item.discount_amount, 0) / item.sessions_total, 2)
end
from public.treatment_plan_items item
where item.id = session.treatment_plan_item_id;

create function private.default_treatment_session_amount()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare item public.treatment_plan_items%rowtype;
declare effective_total numeric(12,2);
declare even_amount numeric(12,2);
begin
  if new.expected_amount <> 0 then return new; end if;
  select * into item from public.treatment_plan_items where id = new.treatment_plan_item_id;
  if item.id is null then return new; end if;
  effective_total := greatest(item.price * item.quantity - item.discount_amount, 0);
  even_amount := round(effective_total / item.sessions_total, 2);
  new.expected_amount := case when new.session_number = item.sessions_total
    then effective_total - even_amount * (item.sessions_total - 1) else even_amount end;
  return new;
end;
$$;
create trigger default_treatment_session_amount_before_insert
  before insert on public.treatment_sessions
  for each row execute function private.default_treatment_session_amount();

create function private.sync_treatment_session_count()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.treatment_sessions
  where treatment_plan_item_id = new.id and session_number > new.sessions_total
    and status <> 'completed';
  insert into public.treatment_sessions
    (clinic_id, treatment_plan_item_id, session_number, status, created_by)
  select new.clinic_id, new.id, number, 'planned', (select auth.uid())
  from generate_series(1, new.sessions_total) number
  on conflict (treatment_plan_item_id, session_number) do nothing;
  return new;
end;
$$;
create trigger sync_treatment_session_count_after_item_change
  after insert or update of sessions_total on public.treatment_plan_items
  for each row execute function private.sync_treatment_session_count();

-- Reception may view plan/session payment context but cannot change clinical
-- details, prices, discounts, or clinical completion state directly.
drop policy treatment_plans_insert on public.treatment_plans;
drop policy treatment_plans_update on public.treatment_plans;
drop policy treatment_plan_items_insert on public.treatment_plan_items;
drop policy treatment_plan_items_update on public.treatment_plan_items;
create policy treatment_plans_insert on public.treatment_plans for insert to authenticated
  with check ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[])));
create policy treatment_plans_update on public.treatment_plans for update to authenticated
  using ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[])))
  with check ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[])));
create policy treatment_plan_items_insert on public.treatment_plan_items for insert to authenticated
  with check ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[])));
create policy treatment_plan_items_update on public.treatment_plan_items for update to authenticated
  using ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[])))
  with check ((select private.has_clinic_role(clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[])));

alter table public.invoices
  add column treatment_session_id uuid,
  add constraint invoices_treatment_session_tenant_fk
    foreign key (treatment_session_id, clinic_id)
    references public.treatment_sessions(id, clinic_id) on delete restrict;
create unique index invoices_one_active_per_session_idx
  on public.invoices (clinic_id, treatment_session_id)
  where treatment_session_id is not null and status <> 'void';

alter table public.treatment_item_payments
  add column treatment_session_id uuid,
  add constraint treatment_item_payments_session_tenant_fk
    foreign key (treatment_session_id, clinic_id)
    references public.treatment_sessions(id, clinic_id) on delete restrict;
create unique index treatment_item_payments_one_session_per_payment_idx
  on public.treatment_item_payments (payment_id)
  where treatment_session_id is not null;

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  order_number text not null,
  order_date date not null default current_date,
  supplier_name text,
  supplier_contact text,
  delivery_address text,
  notes text,
  status text not null default 'draft' check (status in ('draft','issued','cancelled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, order_number),
  unique (id, clinic_id)
);
create index purchase_orders_clinic_date_idx
  on public.purchase_orders (clinic_id, order_date desc);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  purchase_order_id uuid not null,
  inventory_item_id uuid,
  item_name text not null,
  sku text,
  unit text not null default 'units',
  quantity numeric(12,2) not null check (quantity > 0),
  unit_cost numeric(12,2) check (unit_cost is null or unit_cost >= 0),
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (purchase_order_id, clinic_id)
    references public.purchase_orders(id, clinic_id) on delete cascade,
  foreign key (inventory_item_id, clinic_id)
    references public.inventory_items(id, clinic_id) on delete restrict
);
create index purchase_order_items_order_idx
  on public.purchase_order_items (clinic_id, purchase_order_id, position);

create trigger set_purchase_orders_updated_at
  before update on public.purchase_orders
  for each row execute function private.set_updated_at();

create function public.reschedule_appointment(
  p_clinic_id uuid,
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare target public.appointments%rowtype;
begin
  if not (select private.has_clinic_role(
    p_clinic_id,
    array['owner','admin','dentist','hygienist','assistant','front_desk']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  if p_ends_at <= p_starts_at then raise exception 'Appointment end must follow its start'; end if;
  if p_starts_at < now() then raise exception 'Appointments cannot be moved into the past'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_clinic_id::text, 0));

  select * into target from public.appointments
  where id = p_appointment_id and clinic_id = p_clinic_id for update;
  if target.id is null then raise exception 'Appointment not found'; end if;
  if target.status in ('Completed','Cancelled') then
    raise exception 'Completed or cancelled appointments cannot be moved';
  end if;
  if exists (
    select 1 from public.appointments other
    where other.clinic_id = p_clinic_id and other.id <> target.id
      and other.status not in ('Completed','Cancelled')
      and tstzrange(other.starts_at, other.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      and ((target.provider_id is not null and other.provider_id = target.provider_id)
        or (target.provider_id is null and target.doctor_name is not null and target.doctor_name <> '' and other.doctor_name = target.doctor_name)
        or (target.room is not null and target.room <> '' and other.room = target.room))
  ) then raise exception 'The provider or room is already booked at that time'; end if;

  update public.appointments set starts_at = p_starts_at, ends_at = p_ends_at
  where id = target.id and clinic_id = p_clinic_id;
  update public.treatment_sessions set scheduled_at = p_starts_at
  where clinic_id = p_clinic_id and appointment_id = target.id and status <> 'completed';
  return true;
end;
$$;
revoke all on function public.reschedule_appointment(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.reschedule_appointment(uuid, uuid, timestamptz, timestamptz) to authenticated;

create function public.create_treatment_plan_with_price(
  p_clinic_id uuid, p_patient_id uuid, p_title text, p_total_amount numeric
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_plan_id uuid;
begin
  if not (select private.has_clinic_role(
    p_clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  if trim(p_title) = '' or p_total_amount < 0 then raise exception 'Invalid treatment plan'; end if;
  insert into public.treatment_plans
    (clinic_id, patient_id, title, total_amount, quoted_total_amount, status, created_by)
  values
    (p_clinic_id, p_patient_id, trim(p_title), p_total_amount, p_total_amount, 'Proposed', (select auth.uid()))
  returning id into new_plan_id;
  return new_plan_id;
end;
$$;
revoke all on function public.create_treatment_plan_with_price(uuid, uuid, text, numeric) from public, anon;
grant execute on function public.create_treatment_plan_with_price(uuid, uuid, text, numeric) to authenticated;

create function public.set_treatment_session_prices(
  p_clinic_id uuid,
  p_item_id uuid,
  p_expected_amounts numeric[]
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare item public.treatment_plan_items%rowtype;
declare effective_total numeric(12,2);
begin
  if not (select private.has_clinic_role(
    p_clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  select * into item from public.treatment_plan_items
  where id = p_item_id and clinic_id = p_clinic_id for update;
  if item.id is null then raise exception 'Treatment item not found'; end if;
  effective_total := greatest(item.price * item.quantity - item.discount_amount, 0);
  if cardinality(p_expected_amounts) <> item.sessions_total
    or exists (select 1 from unnest(p_expected_amounts) amount where amount < 0)
    or round(coalesce((select sum(amount) from unnest(p_expected_amounts) amount), 0), 2) <> round(effective_total, 2)
  then raise exception 'Session prices must be non-negative and total the final treatment price'; end if;
  update public.treatment_sessions session set expected_amount = prices.amount
  from unnest(p_expected_amounts) with ordinality prices(amount, session_number)
  where session.clinic_id = p_clinic_id
    and session.treatment_plan_item_id = item.id
    and session.session_number = prices.session_number;
  return true;
end;
$$;
revoke all on function public.set_treatment_session_prices(uuid, uuid, numeric[]) from public, anon;
grant execute on function public.set_treatment_session_prices(uuid, uuid, numeric[]) to authenticated;

create function public.record_session_payment(
  p_clinic_id uuid,
  p_session_id uuid,
  p_payment_mode text,
  p_amount numeric,
  p_method text,
  p_reference text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare session_row public.treatment_sessions%rowtype;
declare item public.treatment_plan_items%rowtype;
declare plan public.treatment_plans%rowtype;
declare invoice_id uuid;
declare payment_id uuid;
declare already_paid numeric(12,2);
declare amount_to_collect numeric(12,2);
declare expected numeric(12,2);
begin
  if not (select private.has_clinic_role(
    p_clinic_id, array['owner','admin','billing','front_desk','dentist']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  if p_payment_mode = 'not_paid' then return null; end if;
  if p_payment_mode not in ('full','partial') then raise exception 'Invalid payment mode'; end if;
  if p_method not in ('Card','Cash','Insurance','Bank transfer') then raise exception 'Invalid payment method'; end if;

  select * into session_row from public.treatment_sessions
  where id = p_session_id and clinic_id = p_clinic_id for update;
  if session_row.id is null or session_row.status = 'cancelled' then raise exception 'Session is unavailable'; end if;
  select * into item from public.treatment_plan_items
  where id = session_row.treatment_plan_item_id and clinic_id = p_clinic_id for update;
  select * into plan from public.treatment_plans
  where id = item.treatment_plan_id and clinic_id = p_clinic_id;
  expected := session_row.expected_amount;
  select coalesce(sum(allocation.amount), 0) into already_paid
  from public.treatment_item_payments allocation
  where allocation.clinic_id = p_clinic_id and allocation.treatment_session_id = session_row.id;
  if already_paid >= expected then raise exception 'This session is already fully paid'; end if;
  amount_to_collect := case when p_payment_mode = 'full' then expected - already_paid else p_amount end;
  if amount_to_collect is null or amount_to_collect <= 0 or amount_to_collect > expected - already_paid then
    raise exception 'Payment must be greater than zero and no more than the session balance';
  end if;

  select id into invoice_id from public.invoices
  where clinic_id = p_clinic_id and treatment_session_id = session_row.id and status <> 'void'
  for update;
  if invoice_id is null then
    insert into public.invoices
      (clinic_id, patient_id, treatment_plan_id, treatment_session_id, invoice_number,
       subtotal, total_amount, status)
    values
      (p_clinic_id, plan.patient_id, plan.id, session_row.id,
       'SES-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(replace(session_row.id::text, '-', ''), 1, 8)),
       expected, expected, 'open')
    returning id into invoice_id;
  end if;
  insert into public.payments (clinic_id, invoice_id, amount, method, reference, recorded_by)
  values (p_clinic_id, invoice_id, amount_to_collect, p_method, nullif(trim(p_reference), ''), (select auth.uid()))
  returning id into payment_id;
  insert into public.treatment_item_payments
    (clinic_id, treatment_plan_item_id, treatment_session_id, payment_id, amount)
  values (p_clinic_id, item.id, session_row.id, payment_id, amount_to_collect);

  update public.treatment_plan_items set amount_paid = (
    select coalesce(sum(amount), 0) from public.treatment_item_payments
    where clinic_id = p_clinic_id and treatment_plan_item_id = item.id
  ) where id = item.id;
  update public.invoices set status = case
    when already_paid + amount_to_collect >= expected then 'paid' else 'partial' end
  where id = invoice_id;
  update public.patients patient set outstanding_balance = greatest(finance.balance, 0)
  from (
    select invoice.patient_id,
      coalesce(sum(greatest(invoice.total_amount - coalesce(collected.amount, 0), 0)), 0) balance
    from public.invoices invoice
    left join lateral (
      select sum(transaction.amount) amount from public.payments transaction
      where transaction.invoice_id = invoice.id and transaction.clinic_id = invoice.clinic_id
    ) collected on true
    where invoice.clinic_id = p_clinic_id and invoice.patient_id = plan.patient_id
      and invoice.status <> 'void'
    group by invoice.patient_id
  ) finance where patient.id = finance.patient_id and patient.clinic_id = p_clinic_id;
  return payment_id;
end;
$$;
revoke all on function public.record_session_payment(uuid, uuid, text, numeric, text, text) from public, anon;
grant execute on function public.record_session_payment(uuid, uuid, text, numeric, text, text) to authenticated;

create function public.complete_treatment_session(p_clinic_id uuid, p_session_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare session_row public.treatment_sessions%rowtype;
declare item public.treatment_plan_items%rowtype;
begin
  if not (select private.has_clinic_role(
    p_clinic_id, array['owner','admin','dentist','hygienist']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  select * into session_row from public.treatment_sessions
  where id = p_session_id and clinic_id = p_clinic_id for update;
  if session_row.id is null or session_row.status in ('completed','cancelled') then return false; end if;
  select * into item from public.treatment_plan_items
  where id = session_row.treatment_plan_item_id and clinic_id = p_clinic_id for update;
  update public.treatment_sessions set status = 'completed', completed_at = now() where id = session_row.id;
  update public.treatment_plan_items set
    sessions_completed = (select count(*) from public.treatment_sessions where treatment_plan_item_id = item.id and status = 'completed'),
    status = case when (select count(*) from public.treatment_sessions where treatment_plan_item_id = item.id and status = 'completed') >= sessions_total then 'completed' else 'scheduled' end,
    completed_at = case when (select count(*) from public.treatment_sessions where treatment_plan_item_id = item.id and status = 'completed') >= sessions_total then now() else null end
  where id = item.id;
  update public.treatment_plans treatment_plan set
    sessions_completed = totals.done,
    status = case when totals.done >= totals.total then 'Completed' else 'In progress' end
  from (
    select sum(sessions_completed)::integer done, sum(sessions_total)::integer total
    from public.treatment_plan_items where treatment_plan_id = item.treatment_plan_id and status <> 'cancelled'
  ) totals where treatment_plan.id = item.treatment_plan_id;
  return true;
end;
$$;
revoke all on function public.complete_treatment_session(uuid, uuid) from public, anon;
grant execute on function public.complete_treatment_session(uuid, uuid) to authenticated;

create function public.create_purchase_order(
  p_clinic_id uuid,
  p_order_number text,
  p_order_date date,
  p_supplier_name text,
  p_supplier_contact text,
  p_delivery_address text,
  p_notes text,
  p_items jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_order_id uuid;
begin
  if not (select private.has_clinic_role(
    p_clinic_id, array['owner','admin','assistant']::public.clinic_role[]
  )) then raise exception 'Insufficient clinic permission'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Purchase order requires at least one item';
  end if;
  insert into public.purchase_orders
    (clinic_id, order_number, order_date, supplier_name, supplier_contact,
     delivery_address, notes, status, created_by)
  values
    (p_clinic_id, trim(p_order_number), p_order_date, nullif(trim(p_supplier_name), ''),
     nullif(trim(p_supplier_contact), ''), nullif(trim(p_delivery_address), ''),
     nullif(trim(p_notes), ''), 'issued', (select auth.uid()))
  returning id into new_order_id;

  insert into public.purchase_order_items
    (clinic_id, purchase_order_id, inventory_item_id, item_name, sku, unit,
     quantity, unit_cost, notes, position)
  select p_clinic_id, new_order_id, nullif(item->>'inventoryItemId', '')::uuid,
    trim(item->>'itemName'), nullif(trim(item->>'sku'), ''),
    coalesce(nullif(trim(item->>'unit'), ''), 'units'),
    (item->>'quantity')::numeric, nullif(item->>'unitCost', '')::numeric,
    nullif(trim(item->>'notes'), ''), ordinality::integer - 1
  from jsonb_array_elements(p_items) with ordinality source(item, ordinality)
  where trim(coalesce(item->>'itemName', '')) <> '' and (item->>'quantity')::numeric > 0;
  if not found or (select count(*) from public.purchase_order_items where purchase_order_id = new_order_id) <> jsonb_array_length(p_items) then
    raise exception 'Every purchase-order item requires a name and positive quantity';
  end if;
  return new_order_id;
end;
$$;
revoke all on function public.create_purchase_order(uuid, text, date, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_purchase_order(uuid, text, date, text, text, text, text, jsonb) to authenticated;

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
create policy purchase_orders_select on public.purchase_orders for select to authenticated
  using ((select private.is_clinic_member(clinic_id)));
create policy purchase_orders_insert on public.purchase_orders for insert to authenticated
  with check ((select private.has_clinic_role(clinic_id, array['owner','admin','assistant']::public.clinic_role[])) and created_by = (select auth.uid()));
create policy purchase_orders_update on public.purchase_orders for update to authenticated
  using ((select private.has_clinic_role(clinic_id, array['owner','admin','assistant']::public.clinic_role[])))
  with check ((select private.has_clinic_role(clinic_id, array['owner','admin','assistant']::public.clinic_role[])));
create policy purchase_orders_delete on public.purchase_orders for delete to authenticated
  using ((select private.has_clinic_role(clinic_id, array['owner','admin']::public.clinic_role[])));
create policy purchase_order_items_select on public.purchase_order_items for select to authenticated
  using ((select private.is_clinic_member(clinic_id)));
create policy purchase_order_items_insert on public.purchase_order_items for insert to authenticated
  with check ((select private.has_clinic_role(clinic_id, array['owner','admin','assistant']::public.clinic_role[])));
create policy purchase_order_items_update on public.purchase_order_items for update to authenticated
  using ((select private.has_clinic_role(clinic_id, array['owner','admin','assistant']::public.clinic_role[])))
  with check ((select private.has_clinic_role(clinic_id, array['owner','admin','assistant']::public.clinic_role[])));
create policy purchase_order_items_delete on public.purchase_order_items for delete to authenticated
  using ((select private.has_clinic_role(clinic_id, array['owner','admin']::public.clinic_role[])));

grant select, insert, update, delete on public.purchase_orders, public.purchase_order_items to authenticated;
alter publication supabase_realtime add table public.purchase_orders,
  public.treatment_item_payments;
