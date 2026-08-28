-- Cover foreign-key column order exactly. Existing tenant-first indexes remain
-- useful for clinic-scoped reads; these indexes protect parent updates/deletes.
create index if not exists appointments_created_by_fk_idx on public.appointments (created_by);
create index if not exists appointments_patient_tenant_fk_idx on public.appointments (patient_id, clinic_id);
create index if not exists appointments_procedure_tenant_fk_idx on public.appointments (procedure_id, clinic_id);

create index if not exists clinical_records_appointment_tenant_fk_idx on public.clinical_records (appointment_id, clinic_id);
create index if not exists clinical_records_author_fk_idx on public.clinical_records (author_id);
create index if not exists clinical_records_patient_tenant_fk_idx on public.clinical_records (patient_id, clinic_id);

create index if not exists dental_chart_patient_tenant_fk_idx on public.dental_chart (patient_id, clinic_id);
create index if not exists dental_chart_recorded_by_fk_idx on public.dental_chart (recorded_by);
create index if not exists dental_chart_surfaces_patient_tenant_fk_idx on public.dental_chart_surfaces (patient_id, clinic_id);
create index if not exists dental_chart_surfaces_recorded_by_fk_idx on public.dental_chart_surfaces (recorded_by);

create index if not exists doctor_patient_assignments_assigned_by_fk_idx on public.doctor_patient_assignments (assigned_by);

create index if not exists inventory_movements_item_tenant_fk_idx on public.inventory_movements (inventory_item_id, clinic_id);
create index if not exists inventory_movements_recorded_by_fk_idx on public.inventory_movements (recorded_by);

create index if not exists invoices_appointment_tenant_fk_idx on public.invoices (appointment_id, clinic_id);
create index if not exists invoices_patient_tenant_fk_idx on public.invoices (patient_id, clinic_id);
create index if not exists invoices_plan_tenant_fk_idx on public.invoices (treatment_plan_id, clinic_id);
create index if not exists invoices_session_tenant_fk_idx on public.invoices (treatment_session_id, clinic_id);

create index if not exists patient_files_patient_tenant_fk_idx on public.patient_files (patient_id, clinic_id);
create index if not exists patient_files_uploaded_by_fk_idx on public.patient_files (uploaded_by);
create index if not exists patients_created_by_fk_idx on public.patients (created_by);

create index if not exists payment_installments_invoice_tenant_fk_idx on public.payment_installments (invoice_id, clinic_id);
create index if not exists payments_invoice_tenant_fk_idx on public.payments (invoice_id, clinic_id);
create index if not exists payments_recorded_by_fk_idx on public.payments (recorded_by);

create index if not exists purchase_order_items_inventory_tenant_fk_idx on public.purchase_order_items (inventory_item_id, clinic_id);
create index if not exists purchase_order_items_order_tenant_fk_idx on public.purchase_order_items (purchase_order_id, clinic_id);
create index if not exists purchase_orders_created_by_fk_idx on public.purchase_orders (created_by);

create index if not exists treatment_item_payments_payment_tenant_fk_idx on public.treatment_item_payments (payment_id, clinic_id);
create index if not exists treatment_item_payments_session_tenant_fk_idx on public.treatment_item_payments (treatment_session_id, clinic_id);
create index if not exists treatment_item_payments_item_tenant_fk_idx on public.treatment_item_payments (treatment_plan_item_id, clinic_id);

create index if not exists treatment_plan_items_plan_tenant_fk_idx on public.treatment_plan_items (treatment_plan_id, clinic_id);
create index if not exists treatment_plan_items_procedure_tenant_fk_idx on public.treatment_plan_items (procedure_id, clinic_id);
create index if not exists treatment_plans_created_by_fk_idx on public.treatment_plans (created_by);
create index if not exists treatment_plans_patient_tenant_fk_idx on public.treatment_plans (patient_id, clinic_id);

create index if not exists treatment_sessions_appointment_tenant_fk_idx on public.treatment_sessions (appointment_id, clinic_id);
create index if not exists treatment_sessions_created_by_fk_idx on public.treatment_sessions (created_by);
create index if not exists treatment_sessions_item_tenant_fk_idx on public.treatment_sessions (treatment_plan_item_id, clinic_id);
