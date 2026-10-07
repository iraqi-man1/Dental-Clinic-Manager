-- pgTAP checks for 20261007120000_clinic_hardening.sql.
-- Runs inside a transaction and rolls back. Fixture IDs use distinct prefixes so
-- generated invoice numbers (first 8 hex characters of an appointment or session id)
-- cannot collide.

BEGIN;
SELECT plan(98);

-- ---------------------------------------------------------------------------
-- Fixtures (run as the migration owner)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner1@test.local', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin1@test.local', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor1@test.local', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'billing1@test.local', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'front1@test.local', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'assistant1@test.local', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner2@test.local', '', now(), '{}', '{}', now(), now());

-- New clinics are created without a timezone, so the column default applies.
INSERT INTO public.clinics (id, name, slug) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Hardening Clinic One', 'hardening-clinic-one'),
  ('20000000-0000-0000-0000-000000000002', 'Hardening Clinic Two', 'hardening-clinic-two');

INSERT INTO public.clinic_members (id, clinic_id, user_id, role, status, full_name, email) VALUES
  ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner', 'active', 'Owner One', 'owner1@test.local'),
  ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'admin', 'active', 'Admin One', 'admin1@test.local'),
  ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'dentist', 'active', 'Doctor One', 'doctor1@test.local'),
  ('70000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'billing', 'active', 'Billing One', 'billing1@test.local'),
  ('70000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'front_desk', 'active', 'Front Desk One', 'front1@test.local'),
  ('70000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'assistant', 'active', 'Assistant One', 'assistant1@test.local'),
  ('70000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000009', 'owner', 'active', 'Owner Two', 'owner2@test.local');

INSERT INTO public.procedure_catalog (id, clinic_id, name, category, default_price, is_system) VALUES
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Filling', 'Restorative', 180, true),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Custom Consult', 'Custom', 40, false);

INSERT INTO public.patients (id, clinic_id, patient_number, first_name, last_name, created_by) VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'P-1', 'Patient', 'One', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'P-2', 'Patient', 'Two', '10000000-0000-0000-0000-000000000001');

INSERT INTO public.doctor_patient_assignments (clinic_id, doctor_id, patient_id, assigned_by)
VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

INSERT INTO public.treatment_plans (id, clinic_id, patient_id, title, created_by) VALUES
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Plan One', '10000000-0000-0000-0000-000000000003');

-- Price 180 less discount 20 gives an expected session amount of 160.
INSERT INTO public.treatment_plan_items (id, clinic_id, treatment_plan_id, procedure_id, procedure_code, procedure_name, price, discount_amount, quantity, sessions_total, status) VALUES
  ('41000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'FILL', 'Filling', 180, 20, 1, 1, 'planned');

-- Invoice with price 200 and discount 50: net due 150.
INSERT INTO public.invoices (id, clinic_id, patient_id, invoice_number, subtotal, discount_amount, total_amount, status) VALUES
  ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'TEST-INV-0001', 200, 50, 200, 'open');
SELECT private.recalculate_patient_balance('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');

INSERT INTO public.inventory_items (id, clinic_id, name, category, sku, quantity) VALUES
  ('91000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Other Clinic Item', 'Consumables', 'OTH-1', 5);

SELECT set_config('test.session_1', (SELECT id::text FROM public.treatment_sessions
  WHERE treatment_plan_item_id = '41000000-0000-0000-0000-000000000001' AND session_number = 1), false);

-- ---------------------------------------------------------------------------
-- Schema, defaults, and function privileges
-- ---------------------------------------------------------------------------
SELECT has_column('public', 'payments', 'reversed_at', 'payments record the reversal time');
SELECT has_column('public', 'payments', 'reversed_by', 'payments record who reversed them');
SELECT has_column('public', 'payments', 'reversal_reason', 'payments record the reversal reason');
SELECT is(
  (SELECT column_default FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clinics' AND column_name = 'timezone'),
  '''Asia/Baghdad''::text',
  'new clinics default to the Asia/Baghdad timezone'
);
SELECT is(
  (SELECT timezone FROM public.clinics WHERE id = '20000000-0000-0000-0000-000000000001'),
  'Asia/Baghdad',
  'a clinic inserted without a timezone receives the Asia/Baghdad default'
);
SELECT ok(has_function_privilege('authenticated', 'public.reverse_payment(uuid, uuid, text)', 'EXECUTE'), 'authenticated can reverse payments through the RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.reverse_payment(uuid, uuid, text)', 'EXECUTE'), 'anon cannot reverse payments');
SELECT ok(has_function_privilege('authenticated', 'public.adjust_inventory_stock(uuid, uuid, numeric, text)', 'EXECUTE'), 'authenticated can adjust stock through the RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.adjust_inventory_stock(uuid, uuid, numeric, text)', 'EXECUTE'), 'anon cannot adjust stock');
SELECT ok(has_function_privilege('authenticated', 'public.create_inventory_item(uuid, text, text, text, numeric, numeric, text, text)', 'EXECUTE'), 'authenticated can create inventory items through the RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.create_inventory_item(uuid, text, text, text, numeric, numeric, text, text)', 'EXECUTE'), 'anon cannot create inventory items');
SELECT ok(NOT has_function_privilege('authenticated', 'private.recalculate_patient_balance(uuid, uuid)', 'EXECUTE'), 'balance helpers are not callable by clients');
SELECT ok(NOT has_function_privilege('authenticated', 'public.record_clinic_payment(uuid, uuid, text, numeric, numeric, numeric, text)', 'EXECUTE'), 'the legacy direct payment helper is not callable by clients');

-- ---------------------------------------------------------------------------
-- Privileges: payments, patients, inventory, staff
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT throws_ok($$ UPDATE public.payments SET amount = 1 $$, '42501', 'permission denied for table payments', 'the owner cannot update payments');
SELECT throws_ok($$ DELETE FROM public.payments $$, '42501', 'permission denied for table payments', 'the owner cannot delete payments');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
SELECT throws_ok($$
  INSERT INTO public.payments (clinic_id, invoice_id, amount, method)
  VALUES ('20000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 1, 'Cash')
$$, '42501', 'permission denied for table payments', 'staff cannot insert payments outside the payment RPCs');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
SELECT throws_ok($$
  UPDATE public.patients SET outstanding_balance = 0 WHERE id = '30000000-0000-0000-0000-000000000001'
$$, '42501', 'permission denied for table patients', 'a dentist cannot update patients.outstanding_balance');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT throws_ok($$
  UPDATE public.patients SET outstanding_balance = 0 WHERE id = '30000000-0000-0000-0000-000000000001'
$$, '42501', 'permission denied for table patients', 'the owner cannot write patient balances directly');
SELECT throws_ok($$
  INSERT INTO public.patients (id, clinic_id, patient_number, first_name, last_name, outstanding_balance, created_by)
  VALUES ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001', 'P-9', 'Direct', 'Insert', 500, '10000000-0000-0000-0000-000000000001')
$$, '42501', 'permission denied for table patients', 'a patient cannot be inserted with a client-supplied balance');
SELECT throws_ok($$
  UPDATE public.inventory_items SET quantity = 999 WHERE id = '91000000-0000-0000-0000-000000000002'
$$, '42501', 'permission denied for table inventory_items', 'stock quantity cannot be updated directly');
SELECT throws_ok($$
  INSERT INTO public.inventory_items (clinic_id, name, category, sku, quantity)
  VALUES ('20000000-0000-0000-0000-000000000001', 'Direct Stock', 'Consumables', 'DIRECT-1', 50)
$$, '42501', 'permission denied for table inventory_items', 'stock cannot be created directly with a quantity');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', true);
SELECT throws_ok($$
  INSERT INTO public.inventory_movements (clinic_id, inventory_item_id, quantity_delta, reason)
  VALUES ('20000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', 1, 'Direct')
$$, '42501', 'permission denied for table inventory_movements', 'movements are written only by the stock RPCs');
RESET ROLE;

-- Staff: admins cannot change owners or create owners; owners keep full control.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
SELECT throws_ok($$
  UPDATE public.clinic_members SET role = 'owner' WHERE id = '70000000-0000-0000-0000-000000000003'
$$, '42501', 'new row violates row-level security policy for table "clinic_members"', 'an admin cannot promote a member to owner');
SELECT throws_ok($$
  INSERT INTO public.clinic_members (id, clinic_id, role, status, full_name)
  VALUES ('70000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000001', 'owner', 'active', 'Injected Owner')
$$, '42501', 'new row violates row-level security policy for table "clinic_members"', 'an admin cannot create an owner');
SELECT lives_ok($$
  UPDATE public.clinic_members SET full_name = 'Hacked Owner' WHERE id = '70000000-0000-0000-0000-000000000001'
$$, 'an admin update that targets an owner row is accepted but filtered');
SELECT lives_ok($$
  UPDATE public.clinic_members SET full_name = 'Admin Renamed' WHERE id = '70000000-0000-0000-0000-000000000002'
$$, 'an admin can still update non-owner staff');
RESET ROLE;
SELECT is(
  (SELECT full_name FROM public.clinic_members WHERE id = '70000000-0000-0000-0000-000000000001'),
  'Owner One', 'the owner row is unchanged after an admin attempt'
);
SELECT is(
  (SELECT full_name FROM public.clinic_members WHERE id = '70000000-0000-0000-0000-000000000002'),
  'Admin Renamed', 'the admin can update staff below owner'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT lives_ok($$
  UPDATE public.clinic_members SET role = 'billing' WHERE id = '70000000-0000-0000-0000-000000000004'
$$, 'an owner can change staff roles');
SELECT lives_ok($$
  UPDATE public.clinic_members SET role = 'owner' WHERE id = '70000000-0000-0000-0000-000000000004'
$$, 'an owner can promote a member to owner');
RESET ROLE;
SELECT is(
  (SELECT role::text FROM public.clinic_members WHERE id = '70000000-0000-0000-0000-000000000004'),
  'owner', 'the owner promotion is stored'
);
UPDATE public.clinic_members SET role = 'billing' WHERE id = '70000000-0000-0000-0000-000000000004';

-- ---------------------------------------------------------------------------
-- Price list: system procedures cannot be deleted or un-flagged
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT lives_ok($$
  DELETE FROM public.procedure_catalog WHERE id = '50000000-0000-0000-0000-000000000001'
$$, 'deleting a system procedure is a filtered no-op');
SELECT throws_ok($$
  UPDATE public.procedure_catalog SET is_system = false WHERE id = '50000000-0000-0000-0000-000000000001'
$$, 'P0001', 'The system flag of a price-list procedure cannot be changed', 'a system procedure cannot be un-flagged to make it deletable');
SELECT lives_ok($$
  DELETE FROM public.procedure_catalog WHERE id = '50000000-0000-0000-0000-000000000002'
$$, 'an owner can delete a custom procedure');
RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.procedure_catalog WHERE id = '50000000-0000-0000-0000-000000000001'),
  1::bigint, 'the system procedure still exists'
);
SELECT is(
  (SELECT count(*) FROM public.procedure_catalog WHERE id = '50000000-0000-0000-0000-000000000002'),
  0::bigint, 'the custom procedure was deleted'
);

-- ---------------------------------------------------------------------------
-- Patients: derived balances and a single create/update RPC
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT lives_ok($$
  SELECT public.create_patient(
    '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003',
    'P-3', 'Third Patient', '+9647701234567', NULL, '1990-01-01', 'Other',
    '{}'::text[], '{}'::text[], '', 'active', 500)
$$, 'the owner can create a patient with a client-supplied balance');
SELECT lives_ok($$
  SELECT public.create_patient(
    '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
    'P-1', 'Renamed Patient', '+9647701234567', 'patient1@test.local', '1990-01-01', 'Female',
    '{}'::text[], '{}'::text[], 'Updated notes', 'active', 0)
$$, 'the owner can update an existing patient through create_patient');
RESET ROLE;
SELECT is(
  (SELECT outstanding_balance FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000003'),
  0::numeric, 'a created patient always starts with a zero balance'
);
SELECT is(
  (SELECT outstanding_balance FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000001'),
  150::numeric, 'updating a patient keeps the derived balance (discount subtracted)'
);
SELECT is(
  (SELECT first_name FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000001'),
  'Renamed', 'the update path stores the new demographic data'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
SELECT throws_ok($$
  SELECT public.create_patient(
    '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
    'P-1', 'Front Desk Edit', '+9647701234567', NULL, '1990-01-01', 'Female',
    '{}'::text[], '{}'::text[], '', 'active', 0)
$$, 'P0001', 'Insufficient clinic permission', 'front desk staff cannot edit clinical patient records');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
SELECT lives_ok($$
  SELECT public.create_patient(
    '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
    'P-1', 'Doctor Edit Patient', '+9647701234567', NULL, '1990-01-01', 'Female',
    '{}'::text[], '{}'::text[], '', 'active', 0)
$$, 'the assigned doctor can update their patient');
RESET ROLE;
SELECT is(
  (SELECT outstanding_balance FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000001'),
  150::numeric, 'the doctor update did not change the balance'
);

-- ---------------------------------------------------------------------------
-- Payments: discount-aware balance, overpayment prevention, reversals
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
SELECT lives_ok($$
  SELECT public.record_appointment_payment('20000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 100, 'Cash', 'ref-1')
$$, 'front desk records a partial payment');
SELECT throws_ok($$
  SELECT public.record_appointment_payment('20000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 60, 'Cash', 'ref-over')
$$, 'P0001', 'Payment must be greater than zero and no more than the remaining balance', 'an overpayment is rejected (discount subtracted from the total)');
SELECT throws_ok($$
  SELECT public.record_appointment_payment('20000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 10.005, 'Cash', 'ref-frac')
$$, 'P0001', 'Payment must be greater than zero and no more than the remaining balance', 'a payment with fractions of a cent is rejected');
RESET ROLE;

SELECT set_config('test.payment_a', (SELECT id::text FROM public.payments WHERE invoice_id = '80000000-0000-0000-0000-000000000001' AND amount = 100), false);
SELECT is(
  (SELECT status FROM public.invoices WHERE id = '80000000-0000-0000-0000-000000000001'),
  'partial', 'the invoice is partial after the first payment'
);
SELECT is(
  (SELECT outstanding_balance FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000001'),
  50::numeric, 'the balance subtracts the discount and the payment (200 - 50 - 100)'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
SELECT lives_ok($$
  SELECT public.record_appointment_payment('20000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 50, 'Card', 'ref-2')
$$, 'billing settles the remaining balance');
SELECT throws_ok($$
  SELECT public.record_appointment_payment('20000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 10, 'Card', 'ref-dup')
$$, 'P0001', 'Payment must be greater than zero and no more than the remaining balance', 'a duplicate payment after settlement is rejected');
RESET ROLE;

SELECT set_config('test.payment_b', (SELECT id::text FROM public.payments WHERE invoice_id = '80000000-0000-0000-0000-000000000001' AND amount = 50), false);
SELECT is(
  (SELECT status FROM public.invoices WHERE id = '80000000-0000-0000-0000-000000000001'),
  'paid', 'the invoice is paid once the discounted total is collected'
);
SELECT is(
  (SELECT outstanding_balance FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000001'),
  0::numeric, 'the patient balance is zero when the discounted total is paid'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT throws_ok($$
  SELECT public.reverse_payment('20000000-0000-0000-0000-000000000001', current_setting('test.payment_a')::uuid, '')
$$, 'P0001', 'A reversal reason is required', 'a reversal requires a reason');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
SELECT throws_ok($$
  SELECT public.reverse_payment('20000000-0000-0000-0000-000000000001', current_setting('test.payment_a')::uuid, 'Not allowed')
$$, 'P0001', 'Insufficient clinic permission', 'a dentist cannot reverse payments');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
SELECT lives_ok($$
  SELECT public.reverse_payment('20000000-0000-0000-0000-000000000001', current_setting('test.payment_a')::uuid, 'Entered twice')
$$, 'billing can reverse a payment with a reason');
SELECT throws_ok($$
  SELECT public.reverse_payment('20000000-0000-0000-0000-000000000001', current_setting('test.payment_a')::uuid, 'Again')
$$, 'P0001', 'This payment has already been reversed', 'a second reversal is rejected');
RESET ROLE;

SELECT is(
  (SELECT status FROM public.invoices WHERE id = '80000000-0000-0000-0000-000000000001'),
  'partial', 'reversing a payment recalculates the invoice to partial'
);
SELECT is(
  (SELECT outstanding_balance FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000001'),
  100::numeric, 'reversed payments are excluded from the patient balance'
);
SELECT ok(
  (SELECT reversed_at IS NOT NULL AND reversed_by = '10000000-0000-0000-0000-000000000004'::uuid
     AND reversal_reason = 'Entered twice'
   FROM public.payments WHERE id = current_setting('test.payment_a')::uuid),
  'the reversal stores the time, the actor, and the reason'
);
SELECT is(
  (SELECT amount FROM public.payments WHERE id = current_setting('test.payment_a')::uuid),
  100::numeric, 'the reversed payment row keeps its original amount'
);

SELECT throws_ok($$
  UPDATE public.payments SET reversed_at = now() WHERE id = current_setting('test.payment_b')::uuid
$$, '23514', NULL, 'a reversal without a reversed_by actor and reason violates the consistency check');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT lives_ok($$
  SELECT public.reverse_payment('20000000-0000-0000-0000-000000000001', current_setting('test.payment_b')::uuid, 'Wrong patient')
$$, 'the owner can reverse the second payment');
RESET ROLE;
SELECT is(
  (SELECT status FROM public.invoices WHERE id = '80000000-0000-0000-0000-000000000001'),
  'open', 'reversing every active payment reopens the invoice'
);
SELECT is(
  (SELECT outstanding_balance FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000001'),
  150::numeric, 'the balance returns to the discounted total'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
SELECT throws_ok($$
  SELECT public.record_appointment_payment('20000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 151, 'Cash', 'ref-over-2')
$$, 'P0001', 'Payment must be greater than zero and no more than the remaining balance', 'the reversed amount cannot be exceeded');
SELECT lives_ok($$
  SELECT public.record_appointment_payment('20000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 150, 'Cash', 'ref-3')
$$, 'the full discounted total can be recorded again after reversals');
RESET ROLE;
SELECT is(
  (SELECT status FROM public.invoices WHERE id = '80000000-0000-0000-0000-000000000001'),
  'paid', 'the invoice is paid after re-recording the discounted total'
);

-- ---------------------------------------------------------------------------
-- Session payments: dentists are excluded; clinical completion is separate
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
SELECT throws_ok($$
  SELECT public.record_session_payment('20000000-0000-0000-0000-000000000001', current_setting('test.session_1')::uuid, 'full', 0, 'Cash', NULL)
$$, 'P0001', 'Insufficient clinic permission', 'a dentist cannot call record_session_payment');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
SELECT throws_ok($$
  SELECT public.record_session_payment('20000000-0000-0000-0000-000000000001', current_setting('test.session_1')::uuid, 'partial', 500, 'Cash', NULL)
$$, 'P0001', 'Payment must be greater than zero and no more than the session balance', 'a session payment cannot exceed the session expected amount');
SELECT lives_ok($$
  SELECT public.record_session_payment('20000000-0000-0000-0000-000000000001', current_setting('test.session_1')::uuid, 'full', 0, 'Cash', NULL)
$$, 'front desk can collect the full session amount');
SELECT throws_ok($$
  SELECT public.record_session_payment('20000000-0000-0000-0000-000000000001', current_setting('test.session_1')::uuid, 'full', 0, 'Cash', NULL)
$$, 'P0001', 'This session is already fully paid', 'a session cannot be paid twice');
RESET ROLE;

SELECT is(
  (SELECT amount_paid FROM public.treatment_plan_items WHERE id = '41000000-0000-0000-0000-000000000001'),
  160::numeric, 'the treatment item collected total uses the discounted session amount'
);
SELECT is(
  (SELECT status FROM public.treatment_sessions WHERE id = current_setting('test.session_1')::uuid),
  'planned', 'recording a session payment does not complete the clinical session'
);
SELECT is(
  (SELECT outstanding_balance FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000001'),
  0::numeric, 'the session payment settles the patient balance for that session'
);

SELECT set_config('test.session_payment', (SELECT payment_id::text FROM public.treatment_item_payments
  WHERE treatment_session_id = current_setting('test.session_1')::uuid), false);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
SELECT lives_ok($$
  SELECT public.reverse_payment('20000000-0000-0000-0000-000000000001', current_setting('test.session_payment')::uuid, 'Wrong session')
$$, 'billing can reverse a session payment');
RESET ROLE;
SELECT is(
  (SELECT amount_paid FROM public.treatment_plan_items WHERE id = '41000000-0000-0000-0000-000000000001'),
  0::numeric, 'reversing a session payment restores the treatment item collected total'
);
SELECT is(
  (SELECT status FROM public.treatment_sessions WHERE id = current_setting('test.session_1')::uuid),
  'planned', 'reversing a session payment does not change clinical status'
);
SELECT is(
  (SELECT outstanding_balance FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000001'),
  160::numeric, 'the reversed session amount is owed again'
);

-- ---------------------------------------------------------------------------
-- Appointment invoices use the shared balance calculation (no invoker writes)
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT lives_ok($$
  SELECT public.create_appointment_with_invoice(
    '20000000-0000-0000-0000-000000000001', '61000001-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000001', 'Ignored', 1,
    now() + interval '7 days', now() + interval '7 days 1 hour', 'Room 1', '#0f9f8f')
$$, 'the owner can book an appointment with an invoice');
RESET ROLE;
SELECT is(
  (SELECT outstanding_balance FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000002'),
  180::numeric, 'the new invoice sets the patient balance from the procedure price'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
SELECT lives_ok($$
  SELECT public.create_appointment_with_invoice_for_member(
    '20000000-0000-0000-0000-000000000001', '62000002-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000001', 'Ignored', 1,
    now() + interval '8 days', now() + interval '8 days 1 hour', 'Room 2', '#0f9f8f')
$$, 'front desk can book an appointment for a staff doctor without a balance-write privilege');
RESET ROLE;
SELECT is(
  (SELECT outstanding_balance FROM public.patients WHERE id = '30000000-0000-0000-0000-000000000002'),
  360::numeric, 'the second invoice adds to the patient balance'
);

-- ---------------------------------------------------------------------------
-- Inventory: stock changes only through movements
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT lives_ok($$
  SELECT public.create_inventory_item('20000000-0000-0000-0000-000000000001', 'Gloves', 'Consumables', 'GLV-001', 10, 2, 'box', 'Acme')
$$, 'the owner can create an inventory item with opening stock');
SELECT lives_ok($$
  SELECT public.create_inventory_item('20000000-0000-0000-0000-000000000001', 'Masks', 'Consumables', 'MSK-001', 0, 1, '', NULL)
$$, 'an item without opening stock can be created');
SELECT throws_ok($$
  SELECT public.create_inventory_item('20000000-0000-0000-0000-000000000001', 'Gloves Copy', 'Consumables', 'GLV-001', 1, 1, 'box', NULL)
$$, 'P0001', 'An inventory item with this SKU already exists', 'a duplicate SKU is rejected');
SELECT throws_ok($$
  SELECT public.create_inventory_item('20000000-0000-0000-0000-000000000001', 'Negative', 'Consumables', 'NEG-001', -1, 1, 'box', NULL)
$$, 'P0001', 'Opening quantity must be zero or positive with at most two decimal places', 'a negative opening quantity is rejected');
RESET ROLE;

SELECT is(
  (SELECT quantity FROM public.inventory_items WHERE sku = 'GLV-001' AND clinic_id = '20000000-0000-0000-0000-000000000001'),
  10::numeric, 'the created item stores its opening quantity'
);
SELECT is(
  (SELECT quantity_delta FROM public.inventory_movements m
    JOIN public.inventory_items i ON i.id = m.inventory_item_id
    WHERE i.sku = 'GLV-001' AND m.reason = 'Opening stock'),
  10::numeric, 'the opening stock writes an inventory movement'
);
SELECT is(
  (SELECT count(*) FROM public.inventory_movements m
    JOIN public.inventory_items i ON i.id = m.inventory_item_id WHERE i.sku = 'MSK-001'),
  0::bigint, 'an item without opening stock writes no movement'
);

SELECT set_config('test.gloves', (SELECT id::text FROM public.inventory_items WHERE sku = 'GLV-001'), false);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT is(
  public.adjust_inventory_stock('20000000-0000-0000-0000-000000000001', current_setting('test.gloves')::uuid, -4, 'Used in procedures'),
  6::numeric, 'the owner can adjust stock and receives the new quantity'
);
SELECT throws_ok($$
  SELECT public.adjust_inventory_stock('20000000-0000-0000-0000-000000000001', current_setting('test.gloves')::uuid, -7, 'Too many')
$$, 'P0001', 'Stock cannot go below zero', 'stock cannot go below zero');
SELECT throws_ok($$
  SELECT public.adjust_inventory_stock('20000000-0000-0000-0000-000000000001', current_setting('test.gloves')::uuid, -1, '   ')
$$, 'P0001', 'A stock adjustment reason is required', 'a stock adjustment requires a reason');
SELECT throws_ok($$
  SELECT public.adjust_inventory_stock('20000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', 1, 'Cross tenant')
$$, 'P0001', 'Insufficient clinic permission', 'an owner cannot adjust stock in another clinic');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', true);
SELECT is(
  public.adjust_inventory_stock('20000000-0000-0000-0000-000000000001', current_setting('test.gloves')::uuid, 1, 'Restocked'),
  7::numeric, 'an assistant can adjust stock'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
SELECT throws_ok($$
  SELECT public.adjust_inventory_stock('20000000-0000-0000-0000-000000000001', current_setting('test.gloves')::uuid, 1, 'Front desk')
$$, 'P0001', 'Insufficient clinic permission', 'front desk staff cannot adjust stock');
RESET ROLE;

SELECT is(
  (SELECT quantity FROM public.inventory_items WHERE id = current_setting('test.gloves')::uuid),
  7::numeric, 'the stock quantity reflects only accepted adjustments'
);
SELECT is(
  (SELECT quantity_delta FROM public.inventory_movements WHERE inventory_item_id = current_setting('test.gloves')::uuid AND reason = 'Used in procedures'),
  -4::numeric, 'each accepted adjustment writes a movement'
);

-- ---------------------------------------------------------------------------
-- Finish
-- ---------------------------------------------------------------------------
SELECT * FROM finish();
ROLLBACK;
