-- Let a clinician read the patient they just created while the same atomic
-- transaction establishes the durable doctor-patient assignment.
drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or (select private.can_read_patient(clinic_id, id))
  );

drop policy if exists doctor_patient_assignments_insert on public.doctor_patient_assignments;
create policy doctor_patient_assignments_insert on public.doctor_patient_assignments
  for insert to authenticated
  with check (
    (select private.current_clinic_role(clinic_id)) in ('owner','admin','assistant','front_desk')
    or (
      (select private.current_clinic_role(clinic_id)) in ('dentist','hygienist')
      and doctor_id = (select auth.uid())
      and assigned_by = (select auth.uid())
      and exists (
        select 1 from public.patients patient
        where patient.id = doctor_patient_assignments.patient_id
          and patient.clinic_id = doctor_patient_assignments.clinic_id
          and patient.created_by = (select auth.uid())
      )
    )
  );

alter function public.create_patient(
  uuid, uuid, text, text, text, text, date, text, text[], text[], text,
  text, numeric
) security invoker;
