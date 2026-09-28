-- hy: read-path performance migration 2026-09-29 (TraMex)
-- BAGIAN 1: index untuk kolom FK + komposit pola baca panas
create index if not exists "idx_favorites_propertyid" on public."favorites" (property_id);
create index if not exists "idx_moderation_reports_reporteduserid" on public."moderation_reports" (reported_user_id);
create index if not exists "idx_moderation_reports_resolvedby" on public."moderation_reports" (resolved_by);
create index if not exists "idx_payments_propertyid" on public."payments" (property_id);
create index if not exists "idx_referral_ledger_refereeid" on public."referral_ledger" (referee_id);
create index if not exists "idx_referral_ledger_referralid" on public."referral_ledger" (referral_id);
create index if not exists "idx_referral_ledger_referrerid" on public."referral_ledger" (referrer_id);
create index if not exists "idx_referral_payouts_referrerid" on public."referral_payouts" (referrer_id);
create index if not exists "idx_reviews_authorid" on public."reviews" (author_id);
create index if not exists "idx_reviews_propertyid" on public."reviews" (property_id);
create index if not exists "idx_role_applications_reviewedby" on public."role_applications" (reviewed_by);
create index if not exists "idx_visits_propertyid" on public."visits" (property_id);
create index if not exists "idx_properties_owner_id_status" on public."properties" (owner_id, status);
create index if not exists "idx_properties_city" on public."properties" (city);
create index if not exists "idx_properties_listing_type" on public."properties" (listing_type);
create index if not exists "idx_properties_property_type" on public."properties" (property_type);
create index if not exists "idx_property_media_property_id_sort_order" on public."property_media" (property_id, sort_order);
create index if not exists "idx_favorites_user_id_created_at" on public."favorites" (user_id, created_at desc);
create index if not exists "idx_inquiries_user_id_created_at" on public."inquiries" (user_id, created_at desc);
create index if not exists "idx_inquiries_property_id" on public."inquiries" (property_id);
create index if not exists "idx_inquiries_status" on public."inquiries" (status);
create index if not exists "idx_visits_user_id_scheduled_at" on public."visits" (user_id, scheduled_at);
create index if not exists "idx_visits_agent_id_scheduled_at" on public."visits" (agent_id, scheduled_at);
create index if not exists "idx_rental_requests_renter_id_created_at" on public."rental_requests" (renter_id, created_at desc);
create index if not exists "idx_rental_requests_property_id" on public."rental_requests" (property_id);
create index if not exists "idx_rental_requests_status" on public."rental_requests" (status);
create index if not exists "idx_payments_payer_id_created_at" on public."payments" (payer_id, created_at desc);
create index if not exists "idx_payments_rental_request_id" on public."payments" (rental_request_id);
create index if not exists "idx_ai_conversations_property_id" on public."ai_conversations" (property_id);
create index if not exists "idx_interest_confirmations_user_id" on public."interest_confirmations" (user_id);
create index if not exists "idx_interest_confirmations_agent_id" on public."interest_confirmations" (agent_id);
create index if not exists "idx_interest_confirmations_owner_id" on public."interest_confirmations" (owner_id);
create index if not exists "idx_role_applications_applicant_id" on public."role_applications" (applicant_id);
create index if not exists "idx_role_applications_status" on public."role_applications" (status);
create index if not exists "idx_audit_logs_created_at" on public."audit_logs" (created_at desc);
create index if not exists "idx_audit_logs_actor_id" on public."audit_logs" (actor_id);
create index if not exists "idx_audit_logs_entity_type_entity_id" on public."audit_logs" (entity_type, entity_id);
create index if not exists "idx_moderation_reports_property_id" on public."moderation_reports" (property_id);
create index if not exists "idx_moderation_reports_reporter_id" on public."moderation_reports" (reporter_id);
create index if not exists "idx_moderation_reports_status" on public."moderation_reports" (status);
create index if not exists "idx_notaries_user_id" on public."notaries" (user_id);
create index if not exists "idx_notary_requests_user_id" on public."notary_requests" (user_id);
create index if not exists "idx_notary_requests_property_id" on public."notary_requests" (property_id);
create index if not exists "idx_notary_requests_notary_id" on public."notary_requests" (notary_id);
create index if not exists "idx_listing_alerts_user_id" on public."listing_alerts" (user_id);
create index if not exists "idx_transaction_reports_user_id" on public."transaction_reports" (user_id);
create index if not exists "idx_transaction_reports_property_id" on public."transaction_reports" (property_id);

-- BAGIAN 2: optimasi RLS — bungkus auth.uid()/auth.jwt() jadi (select ...) agar dievaluasi sekali per query (bukan per baris)
alter policy "ai_analyses_admin_select" on "public"."ai_analyses" USING ((EXISTS ( SELECT 1
   FROM user_roles r
  WHERE ((r.user_id = (select auth.uid())) AND (r.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));
alter policy "ai_analyses_self_select" on "public"."ai_analyses" USING (((target_id IS NOT NULL) AND (target_id = (select auth.uid()))));
alter policy "ai_conversations_read" on "public"."ai_conversations" USING (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = ai_conversations.property_id) AND (p.owner_id = (select auth.uid())))))));
alter policy "feature_flags_super_write" on "public"."feature_flags" USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'super_admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'super_admin'::text)))));
alter policy "inquiries_participant_insert" on "public"."inquiries" WITH CHECK (((user_id = (select auth.uid())) OR (agent_id = (select auth.uid()))));
alter policy "listing_alerts_owner_all" on "public"."listing_alerts" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
alter policy "notifications_owner_delete" on "public"."notifications" USING (((select auth.uid()) = user_id));
alter policy "notifications_owner_select" on "public"."notifications" USING (((select auth.uid()) = user_id));
alter policy "notifications_owner_update" on "public"."notifications" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
alter policy "partner_availability_owner" on "public"."partner_availability" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
alter policy "partner_leads_admin_read" on "public"."partner_leads" USING ((EXISTS ( SELECT 1
   FROM user_roles r
  WHERE ((r.user_id = (select auth.uid())) AND (r.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));
alter policy "platform_settings_super_write" on "public"."platform_settings" USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'super_admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'super_admin'::text)))));
alter policy "profiles_update_own" on "public"."profiles" USING ((id = (select auth.uid()))) WITH CHECK (((id = (select auth.uid())) AND ((role IS NULL) OR (role = ANY (ARRAY['user'::text, 'agent'::text])) OR (NOT (role IS DISTINCT FROM private.stored_profile_role((select auth.uid())))))));
alter policy "properties_owner_insert" on "public"."properties" WITH CHECK ((owner_id = (select auth.uid())));
alter policy "properties_owner_update" on "public"."properties" USING ((owner_id = (select auth.uid()))) WITH CHECK ((owner_id = (select auth.uid())));
alter policy "push_subscriptions_delete_own" on "public"."push_subscriptions" USING ((user_id = (select auth.uid())));
alter policy "push_subscriptions_insert_own" on "public"."push_subscriptions" WITH CHECK ((user_id = (select auth.uid())));
alter policy "push_subscriptions_select_own" on "public"."push_subscriptions" USING ((user_id = (select auth.uid())));
alter policy "push_subscriptions_update_own" on "public"."push_subscriptions" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
alter policy "transaction_reports_own_insert" on "public"."transaction_reports" WITH CHECK ((user_id = (select auth.uid())));
alter policy "transaction_reports_own_select" on "public"."transaction_reports" USING ((user_id = (select auth.uid())));
alter policy "transaction_reports_own_update" on "public"."transaction_reports" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
