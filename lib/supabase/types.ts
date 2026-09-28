export type Role = 'user' | 'agent' | 'admin' | 'super_admin'
export type ListingType = 'sale' | 'rent'
export type PropertyStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'archived'

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] }

export interface Database {
  public: {
    Tables: {
      profiles: Row<{ id: string; full_name: string | null; phone: string | null; avatar_url: string | null; role: Role; created_at: string; updated_at: string }>
      properties: Row<{ id: string; owner_id: string; title: string; description: string | null; listing_type: ListingType; status: PropertyStatus; property_type: string; city: string; district: string | null; address: string | null; price: number; price_period: 'total' | 'monthly' | 'yearly' | null; bedrooms: number; bathrooms: number; land_area: number | null; building_area: number | null; furnished: 'furnished' | 'unfurnished' | 'semi_furnished' | null; utilities_included: boolean; deposit_amount: number | null; service_charge: number | null; maintenance_fee: number | null; available_from: string | null; verified_at: string | null; province: string | null; postal_code: string | null; meeting_point: string | null; meeting_point_lat: number | null; meeting_point_lng: number | null; map_url: string | null; moderation_note: string | null; moderated_at: string | null; moderated_by: string | null; ai_summary: string | null; ai_verdict: string | null; ai_confidence: number | null; ai_analyzed_at: string | null; ai_facts: any; ai_signals: any; negotiable: boolean | null; certificate: string | null; year_built: number | null; floors: number | null; carports: number | null; electricity_va: number | null; water_source: string | null; property_condition: string | null; amenities: any; nearby: any; min_lease_months: number | null; rent_payment_terms: string | null; occupancy_status: string | null; extra_notes: string | null; featured: boolean | null; score: number | null; listings_ready: boolean | null; fraud_flag: boolean | null; fraud_note: string | null; created_at: string; updated_at: string }>
      property_media: Row<{ id: string; property_id: string; storage_path: string; media_type: 'image' | 'video' | 'floorplan'; sort_order: number; created_at: string }>
      favorites: Row<{ user_id: string; property_id: string; created_at: string }>
      inquiries: Row<{ id: string; property_id: string; user_id: string; agent_id: string | null; status: string; message: string; reply_message: string | null; replied_at: string | null; source: string | null; follow_up_note: string | null; created_at: string; updated_at: string }>
      visits: Row<{ id: string; property_id: string; user_id: string; agent_id: string | null; scheduled_at: string; status: string; notes: string | null; interest: string | null; buyer_feedback: string | null; follow_up_sent_at: string | null; completed_at: string | null; created_at: string }>
      rental_requests: Row<{ id: string; property_id: string; renter_id: string; start_date: string; end_date: string | null; duration_unit: string; status: string; deposit_amount: number | null; service_charge: number | null; maintenance_fee: number | null; created_at: string; updated_at: string }>
      payments: Row<{ id: string; payer_id: string; property_id: string | null; rental_request_id: string | null; amount: number; currency: string; payment_type: string; status: string; due_at: string | null; paid_at: string | null; provider: string | null; provider_reference: string | null; created_at: string }>
      reviews: Row<{ id: string; property_id: string; author_id: string; rating: number; body: string | null; created_at: string }>
      moderation_reports: Row<{ id: string; reporter_id: string | null; property_id: string | null; reported_user_id: string | null; reason: string; status: string; resolution_note: string | null; resolved_by: string | null; created_at: string; resolved_at: string | null }>
      audit_logs: Row<{ id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown>; created_at: string }>
      // Tabel tambahan yang dipakai aplikasi tetapi belum tercantum eksplisit di atas.
      // Index signature ini menjaga `.from('nama_tabel')` tetap bertipe longgar
      // (bukan `never`) supaya tipe hasil query tidak menghalangi akses properti.
      [key: string]: Row<Record<string, any>>
    }
    Views: Record<string, never>
    Functions: { [key: string]: { Args: any; Returns: any } }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
