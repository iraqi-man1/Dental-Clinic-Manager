BEGIN;
SELECT plan(26);

SELECT has_table('public', 'doctor_patient_assignments', 'doctor-patient assignments exist');
SELECT has_column('public', 'appointments', 'treatment_price', 'appointments keep a price snapshot');
SELECT has_column('public', 'appointments', 'provider_member_id', 'appointments link to clinic staff records');
SELECT has_column('public', 'invoices', 'appointment_id', 'invoices link to appointments');
SELECT has_column('public', 'payments', 'receipt_number', 'payments have receipt numbers');

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@test.local', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor1@test.local', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor2@test.local', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff@test.local', '', now(), '{}', '{}', now(), now());

INSERT INTO public.clinics (id, name, slug, currency)
VALUES ('20000000-0000-0000-0000-000000000001', 'RLS Test Clinic', 'rls-test-clinic', 'IQD');
SELECT is((SELECT count(*) FROM public.procedure_catalog WHERE clinic_id = '20000000-0000-0000-0000-000000000001'), 0::bigint, 'new clinics start with an empty Price List');

INSERT INTO public.clinic_members (clinic_id, user_id, role, status, full_name, email)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner', 'active', 'Owner', 'owner@test.local'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'dentist', 'active', 'Doctor One', 'doctor1@test.local'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'dentist', 'active', 'Doctor Two', 'doctor2@test.local'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'front_desk', 'active', 'Staff User', 'staff@test.local');

INSERT INTO public.patients (id, clinic_id, patient_number, first_name, last_name, created_by)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'P-1', 'Patient', 'One', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'P-2', 'Patient', 'Two', '10000000-0000-0000-0000-000000000001');
INSERT INTO public.doctor_patient_assignments (clinic_id, doctor_id, patient_id, assigned_by)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001');
INSERT INTO public.treatment_plans (id, clinic_id, patient_id, title, created_by)
VALUES
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Plan One', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Plan Two', '10000000-0000-0000-0000-000000000003');
INSERT INTO public.dental_chart (clinic_id, patient_id, tooth_number, condition)
VALUES
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'Caries'),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 2, 'Filling');
INSERT INTO public.procedure_catalog (id, clinic_id, name, category, default_price)
VALUES ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Snapshot Procedure', 'Test', 50000);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT lives_ok($$
  SELECT public.create_appointment_with_invoice(
    '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000001', 'Ignored', 1,
    now() + interval '7 days', now() + interval '7 days 1 hour', 'Room 1', '#0f9f8f')
$$, 'an administrator can create an appointment and invoice atomically');
SELECT lives_ok($$
  SELECT public.create_appointment_with_invoice(
    '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000001', 'Ignored', 1,
    now() + interval '7 days', now() + interval '7 days 1 hour', 'Room 1', '#0f9f8f')
$$, 'simultaneous appointments for the same provider and room are allowed');
SELECT lives_ok($$
  INSERT INTO public.clinic_members (id, clinic_id, role, status, full_name)
  VALUES ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'dentist', 'active', 'Accountless Doctor')
$$, 'an administrator can create staff without an authentication account');
SELECT lives_ok($$
  SELECT public.create_appointment_with_invoice_for_member(
    '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001', 'Ignored', 1,
    now() + interval '8 days', now() + interval '8 days 1 hour', 'Room 2', '#0f9f8f')
$$, 'an administrator can schedule an accountless doctor');
RESET ROLE;

SELECT is((
  SELECT count(*) FROM public.clinic_members
  WHERE clinic_id = '20000000-0000-0000-0000-000000000001'
    AND full_name = 'Accountless Doctor' AND user_id IS NULL
), 1::bigint, 'accountless staff is stored without a user id');
SELECT is((
  SELECT provider_member_id FROM public.appointments
  WHERE id = '60000000-0000-0000-0000-000000000003'
), '70000000-0000-0000-0000-000000000001'::uuid, 'the appointment references the accountless staff record');
SELECT is((
  SELECT provider_id FROM public.appointments
  WHERE id = '60000000-0000-0000-0000-000000000003'
), NULL::uuid, 'an accountless appointment does not require an auth user');

UPDATE public.procedure_catalog SET default_price = 60000
WHERE id = '50000000-0000-0000-0000-000000000001';
SELECT is((SELECT treatment_price FROM public.appointments WHERE id = '60000000-0000-0000-0000-000000000001'), 50000::numeric, 'appointment price remains the original snapshot');
SELECT is((SELECT original_price FROM public.invoices WHERE appointment_id = '60000000-0000-0000-0000-000000000001'), 50000::numeric, 'invoice price remains the original snapshot');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
SELECT is((SELECT count(*) FROM public.patients), 1::bigint, 'doctor one sees only assigned patients');
SELECT is((SELECT count(*) FROM public.treatment_plans), 1::bigint, 'doctor one sees only assigned treatment plans');
SELECT is((SELECT count(*) FROM public.dental_chart), 1::bigint, 'doctor one sees only assigned dental-chart rows');
SELECT is((SELECT count(*) FROM public.appointments), 2::bigint, 'assigned provider sees only their appointments');
SELECT lives_ok($$
  SELECT public.create_patient(
    '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003',
    'P-3', 'Patient Three', '+9647701234567', null, '1990-01-01', 'Other',
    '{}'::text[], '{}'::text[], '', 'active', 0)
$$, 'a clinician can create a patient atomically');
SELECT is((
  SELECT count(*) FROM public.doctor_patient_assignments
  WHERE patient_id = '30000000-0000-0000-0000-000000000003'
    AND doctor_id = '10000000-0000-0000-0000-000000000002'
), 1::bigint, 'the creating clinician is assigned to the new patient');
SELECT is((SELECT count(*) FROM public.patients), 2::bigint, 'the clinician can immediately read the new patient');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
SELECT is((SELECT count(*) FROM public.patients), 3::bigint, 'staff can view patients');
SELECT is((SELECT count(*) FROM public.treatment_plans), 0::bigint, 'staff cannot retrieve treatment plans');
SELECT is((SELECT count(*) FROM public.dental_chart), 0::bigint, 'staff cannot retrieve dental charts');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
SELECT is((SELECT count(*) FROM public.patients), 1::bigint, 'doctor two cannot retrieve doctor one patient');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
