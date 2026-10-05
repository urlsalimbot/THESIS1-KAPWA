-- ============================================================================
-- KAPWA - MSWDO Norzagaray Social Welfare System
-- PostgreSQL schema (structure only, no data) - raw pg_dump output.
--
-- 61 tables, 49 foreign keys. This file is the source of truth for the schema;
-- kapwa-oracle.ddl is its Oracle translation for Oracle SQL Developer Data Modeler.
--
-- Regenerate (disposable dev cluster, see docs/podman-postgres-dev.md):
--   pg_dump --schema-only --no-owner --no-privileges \
--     -h localhost -p 5433 -U kapwa -d erd_fresh > docs/database/kapwa-schema.sql
--
-- Replay on a fresh database (superuser needed for the CREATE EXTENSION lines):
--   createdb -U postgres kapwa
--   psql -v ON_ERROR_STOP=1 -U postgres -d kapwa -f docs/database/kapwa-schema.sql
--
-- The two pg_dump `\restrict` psql guards were removed: they are bound to a
-- single dump session and other clients do not understand them.
-- ============================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'SQL_ASCII';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: hash_chain_prev(text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hash_chain_prev(hash_table text, order_field text, new_id uuid) RETURNS TABLE(prev_id uuid, prev_hash text)
    LANGUAGE plpgsql
    AS $_$
    DECLARE q TEXT;
    BEGIN
      q := format('SELECT id, hash FROM %I WHERE id <> $1 AND hash IS NOT NULL ORDER BY %I DESC, id DESC LIMIT 1', hash_table, order_field);
      RETURN QUERY EXECUTE q USING new_id;
    END $_$;


--
-- Name: hash_chain_tg_beneficiaries(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hash_chain_tg_beneficiaries() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE prev RECORD;
      BEGIN
        SELECT * INTO prev FROM hash_chain_prev('beneficiaries', 'created_at', NEW.id);
        IF prev.prev_id IS NULL THEN
          NEW.hash := encode(digest('genesis', 'sha256'), 'hex');
          NEW.prev_hash := NULL;
        ELSE
          NEW.prev_hash := prev.prev_hash;
          NEW.hash := encode(digest('{"id":"' || prev.prev_id::text || '","hash":"' || COALESCE(prev.prev_hash, '') || '"}', 'sha256'), 'hex');
        END IF;
        RETURN NEW;
      END $$;


--
-- Name: hash_chain_tg_cases(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hash_chain_tg_cases() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE prev RECORD;
      BEGIN
        SELECT * INTO prev FROM hash_chain_prev('cases', 'created_at', NEW.id);
        IF prev.prev_id IS NULL THEN
          NEW.hash := encode(digest('genesis', 'sha256'), 'hex');
          NEW.prev_hash := NULL;
        ELSE
          NEW.prev_hash := prev.prev_hash;
          NEW.hash := encode(digest('{"id":"' || prev.prev_id::text || '","hash":"' || COALESCE(prev.prev_hash, '') || '"}', 'sha256'), 'hex');
        END IF;
        RETURN NEW;
      END $$;


--
-- Name: hash_chain_tg_consent_ledger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hash_chain_tg_consent_ledger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE prev RECORD;
      BEGIN
        SELECT * INTO prev FROM hash_chain_prev('consent_ledger', 'granted_at', NEW.id);
        IF prev.prev_id IS NULL THEN
          NEW.hash := encode(digest('genesis', 'sha256'), 'hex');
          NEW.prev_hash := NULL;
        ELSE
          NEW.prev_hash := prev.prev_hash;
          NEW.hash := encode(digest('{"id":"' || prev.prev_id::text || '","hash":"' || COALESCE(prev.prev_hash, '') || '"}', 'sha256'), 'hex');
        END IF;
        RETURN NEW;
      END $$;


--
-- Name: uuid_generate_v7(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.uuid_generate_v7() RETURNS uuid
    LANGUAGE plpgsql
    AS $$
    DECLARE
      unix_ts_ms bytea;
      rand bytea;
      result bytea;
    BEGIN
      unix_ts_ms = substring(
        int8send((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)
        FROM 3
      );
      rand = gen_random_bytes(10);
      rand = set_byte(rand, 0, (0x70 | (get_byte(rand, 0) & 0x0f)));
      rand = set_byte(rand, 2, (0x80 | (get_byte(rand, 2) & 0x3f)));
      result = unix_ts_ms || substring(rand FROM 1 FOR 3) || substring(rand FROM 4 FOR 7);
      RETURN encode(result, 'hex')::uuid;
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_card_seq; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_card_seq (
    id integer NOT NULL,
    year integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: access_card_seq_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.access_card_seq_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: access_card_seq_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.access_card_seq_id_seq OWNED BY public.access_card_seq.id;


--
-- Name: access_card_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_card_services (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    access_card_code text,
    service_date date NOT NULL,
    service_rendered text NOT NULL,
    cost numeric(12,2),
    agency text,
    agency_id uuid,
    worker_name_sign text,
    intervention_id uuid,
    category character varying,
    logged_by uuid,
    source_barangay text
);


--
-- Name: agencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agencies (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: agency_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agency_contacts (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    agency_id uuid NOT NULL,
    contact_type character varying(50) NOT NULL,
    value text NOT NULL,
    is_primary boolean,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: analysis_run_clusters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analysis_run_clusters (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    run_id uuid NOT NULL,
    cluster_index integer NOT NULL,
    size integer NOT NULL,
    centroid jsonb,
    profile jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: analysis_run_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analysis_run_members (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    run_id uuid NOT NULL,
    household_id uuid NOT NULL,
    cluster_index integer NOT NULL,
    distance numeric(12,6),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: analysis_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analysis_runs (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    model character varying DEFAULT 'household_clustering'::character varying NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    params jsonb,
    metrics jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_by uuid,
    error text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT analysis_runs_status_check CHECK (((status)::text = ANY ((ARRAY['completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text DEFAULT ''::text NOT NULL,
    body_html text DEFAULT ''::text NOT NULL,
    body_text text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT announcements_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    action text NOT NULL,
    reference_id text,
    user_id text,
    details jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: beneficiaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beneficiaries (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    person_id uuid,
    user_id uuid,
    household_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    hash text,
    prev_hash text
);


--
-- Name: beneficiary_claimants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beneficiary_claimants (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    beneficiary_id uuid NOT NULL,
    claimant_id uuid NOT NULL,
    relationship text NOT NULL,
    authorization_url text,
    calendar_year integer,
    is_primary boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: beneficiary_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beneficiary_roles (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    person_id uuid NOT NULL,
    household_id uuid,
    user_id uuid,
    consent_status text DEFAULT 'active'::text,
    access_card_code text,
    category text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: case_assistances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_assistances (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id uuid NOT NULL,
    assistance_type character varying(50) NOT NULL,
    amount numeric(12,2),
    mode character varying(50),
    source_of_fund character varying(100),
    legislator_specify character varying(255),
    details jsonb,
    approved_by_signature text,
    approved_by_role character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: case_compliance_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_compliance_items (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id uuid NOT NULL,
    household_member_id uuid,
    compliance_type character varying,
    due_date date NOT NULL,
    month_label character varying,
    met boolean DEFAULT false,
    met_at timestamp without time zone,
    met_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT case_compliance_items_compliance_type_check CHECK (((compliance_type)::text = ANY ((ARRAY['school_attendance'::character varying, 'health_checkup'::character varying, 'fds'::character varying])::text[])))
);


--
-- Name: case_control_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_control_counters (
    year integer NOT NULL,
    last_seq integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: case_event_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_event_reminders (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    event_id uuid NOT NULL,
    offset_minutes integer NOT NULL,
    channel character varying(16) NOT NULL,
    sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: case_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_events (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id uuid NOT NULL,
    event_type character varying(32) NOT NULL,
    attended boolean,
    title text,
    venue text,
    event_date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    notes text,
    status character varying(32) DEFAULT 'planned'::character varying NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: case_follow_up_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_follow_up_visits (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id uuid NOT NULL,
    visit_date date NOT NULL,
    visit_type text NOT NULL,
    notes text,
    outcome text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: case_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_history (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id character varying NOT NULL,
    from_status text,
    to_status text NOT NULL,
    changed_by_role character varying,
    changed_by_id character varying,
    remarks character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    transition_type character varying DEFAULT 'standard'::character varying NOT NULL,
    override_reason character varying
);


--
-- Name: case_interventions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_interventions (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id text NOT NULL,
    program_id uuid,
    service_name text NOT NULL,
    category text,
    delivery_date date,
    amount numeric(12,2),
    mode_of_delivery text,
    fund_source text,
    notes text,
    delivered_by text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by uuid,
    intervention_type text,
    program_enrollment_id uuid
);


--
-- Name: case_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_payouts (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id uuid NOT NULL,
    cycle_no character varying,
    scheduled_at date NOT NULL,
    amount numeric(12,2),
    status character varying(20) DEFAULT 'scheduled'::character varying,
    notified_at timestamp without time zone,
    notified_by uuid,
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT case_payouts_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'completed'::character varying, 'missed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: case_referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_referrals (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id uuid NOT NULL,
    agency character varying(255),
    status character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    reason text NOT NULL,
    contact_info text,
    created_by uuid
);


--
-- Name: case_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_requirements (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id uuid NOT NULL,
    requirement_key character varying(100) NOT NULL,
    met boolean,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: case_step_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_step_locks (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id text NOT NULL,
    step_key text NOT NULL,
    locked_by uuid,
    locked_by_name text,
    locked_at timestamp without time zone DEFAULT now()
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cases (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    control_no text NOT NULL,
    beneficiary_id uuid,
    renewal_of_case_id uuid,
    service_requested text[],
    requirements_checklist jsonb,
    status text DEFAULT 'enrolled'::text,
    certificate_url text,
    petty_cash_voucher_url text,
    assigned_worker_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    problems_presented text,
    social_worker_assessment text,
    client_category text,
    case_category text,
    court_docket_number text,
    crisis_mode boolean DEFAULT false NOT NULL,
    discernment_assessed_at date,
    discernment_result text,
    discernment_notes text,
    protection_order_type text,
    protection_order_issued_at date,
    protection_order_issued_by text,
    protection_order_notes text,
    enrollments_not_needed boolean DEFAULT false NOT NULL,
    solo_parent_id_issued_date date,
    solo_parent_id_number text,
    solo_parent_notes text,
    adoption_dvc_date date,
    adoption_case_study_date date,
    adoption_cdclaa_received boolean,
    adoption_notes text,
    nature_of_service text[],
    financial_subsidies jsonb,
    amount_assistance numeric(12,2),
    mode_financial_assistance text,
    source_of_fund text,
    legislator_specify text,
    other_assistance jsonb,
    interviewed_by text,
    assigned_worker_name character varying,
    client_signature text,
    approved_by_signature text,
    approved_by_role character varying,
    referral_not_needed boolean DEFAULT false NOT NULL,
    intervention_not_needed boolean DEFAULT false NOT NULL,
    self_reliance_plan text,
    referrals jsonb,
    follow_up_date date,
    exit_notes text,
    frva_score numeric(5,2),
    swdi_score numeric(5,2),
    family_dialogue_notes text,
    self_reliance_level integer,
    sustainability_plan text,
    transition_date date,
    closure_outcome character varying,
    closure_date date,
    follow_up_visits jsonb,
    approved_by_name text,
    hash text,
    prev_hash text,
    CONSTRAINT cases_status_check CHECK ((status = ANY (ARRAY['enrolled'::text, 'assessed'::text, 'in_review'::text, 'active'::text, 'transitioning'::text, 'closed'::text, 'aftercare'::text])))
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    sender_id text NOT NULL,
    recipient_id text NOT NULL,
    content text NOT NULL,
    conversation_id text NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    sender_name character varying
);


--
-- Name: consent_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_ledger (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    beneficiary_id uuid,
    purpose text,
    channel text,
    status text DEFAULT 'active'::text,
    granted_at timestamp without time zone DEFAULT now(),
    revoked_at timestamp without time zone,
    revoked_reason text,
    hash text,
    prev_hash text
);


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_messages (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    subject character varying(200),
    message text NOT NULL,
    status character varying(10) DEFAULT 'new'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: csr_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.csr_reports (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id uuid NOT NULL,
    control_no text NOT NULL,
    social_worker_name text NOT NULL,
    social_worker_position text,
    referral_origin text,
    reason_for_referral text,
    problem_presented text,
    family_background text,
    socio_economic_profile text,
    assessment_analysis text,
    recommendation text,
    intervention_plan text,
    client_signature_url text,
    worker_signature_url text,
    finalized boolean DEFAULT false,
    created_by text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: csr_seq_2026; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.csr_seq_2026
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_vault; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_vault (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    file_name text NOT NULL,
    original_name text,
    mime_type text,
    file_size integer DEFAULT 0,
    case_id uuid,
    beneficiary_id uuid,
    category text,
    notes text,
    uploaded_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    irf_id uuid,
    announcement_id uuid,
    verified_at timestamp without time zone,
    verified_by uuid,
    requirement_key character varying
);


--
-- Name: form_version_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_version_history (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    program_id uuid NOT NULL,
    form_template jsonb NOT NULL,
    version integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: household_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.household_memberships (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    person_id uuid NOT NULL,
    household_id uuid,
    relationship text NOT NULL,
    is_primary boolean DEFAULT false,
    status text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    status_reason text
);


--
-- Name: households; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.households (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    primary_beneficiary_id uuid,
    barangay text,
    estimated_income numeric(12,2),
    verified_by text,
    access_card_code text,
    verified_at timestamp without time zone DEFAULT now(),
    nhts_pr_id text
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_keys (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    key text NOT NULL,
    result jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: inter_agency_referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inter_agency_referrals (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id uuid,
    person_id uuid NOT NULL,
    from_agency_id uuid NOT NULL,
    to_agency_id uuid NOT NULL,
    status text DEFAULT 'referred'::text NOT NULL,
    reason text NOT NULL,
    notes text,
    legal_basis_code text NOT NULL,
    consent_ledger_id uuid,
    outcome text,
    received_at timestamp without time zone,
    actioned_at timestamp without time zone,
    closed_at timestamp without time zone,
    declined_reason text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT inter_agency_referrals_status_check CHECK ((status = ANY (ARRAY['referred'::text, 'received'::text, 'actioned'::text, 'closed'::text, 'declined'::text])))
);


--
-- Name: intervention_required_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intervention_required_documents (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    intervention_type character varying(32) NOT NULL,
    document_key character varying(64) NOT NULL,
    mandatory boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: irf_blotter_seq; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.irf_blotter_seq (
    id integer NOT NULL,
    year integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: irf_blotter_seq_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.irf_blotter_seq_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: irf_blotter_seq_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.irf_blotter_seq_id_seq OWNED BY public.irf_blotter_seq.id;


--
-- Name: irf_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.irf_cases (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    blotter_entry_number text NOT NULL,
    case_category text NOT NULL,
    datetime_reported timestamp without time zone,
    datetime_incident timestamp without time zone,
    item_a_reporting_person jsonb,
    item_b_person_reported jsonb,
    encrypted_narration bytea,
    case_disposition text,
    msdw_signature_url text,
    reporting_signature_url text,
    created_at timestamp without time zone DEFAULT now(),
    key_wraps jsonb,
    key_version integer DEFAULT 1,
    dismissal_reason text,
    case_id uuid
);


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying(255) NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    user_id character varying NOT NULL,
    channel character varying NOT NULL,
    category character varying NOT NULL,
    opted_in boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    recipient_id text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    channel text DEFAULT 'in_app'::text,
    phone text,
    sent boolean DEFAULT false,
    sent_at timestamp without time zone,
    is_read boolean DEFAULT false,
    category text DEFAULT 'system'::text,
    reference_id text,
    created_at timestamp without time zone DEFAULT now(),
    consent_skipped boolean DEFAULT false,
    email character varying
);


--
-- Name: office_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.office_events (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    title text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    repeat_rule jsonb,
    visible_to character varying(32) DEFAULT 'staff'::character varying NOT NULL,
    location text,
    owner_id uuid NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_codes (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    phone text NOT NULL,
    code text NOT NULL,
    verified boolean DEFAULT false,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: person_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_addresses (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    person_id uuid NOT NULL,
    address_type character varying(50) NOT NULL,
    barangay character varying(255),
    city character varying(255),
    province character varying(255),
    postal character varying(20),
    is_primary boolean,
    raw text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    street text,
    region text
);


--
-- Name: person_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_contacts (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    person_id uuid NOT NULL,
    contact_type character varying(50) NOT NULL,
    value text NOT NULL,
    is_primary boolean,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: persons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persons (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    surname text NOT NULL,
    first_name text NOT NULL,
    middle_name text,
    gender text,
    dob date NOT NULL,
    philsys_number text,
    place_of_birth text,
    civil_status text,
    occupation text,
    estimated_monthly_income numeric(12,2),
    search_vector tsvector,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    extension text,
    CONSTRAINT persons_gender_check CHECK ((gender = ANY (ARRAY['Male'::text, 'Female'::text])))
);


--
-- Name: program_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_enrollments (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    case_id uuid NOT NULL,
    program_id uuid NOT NULL,
    enrolled_at date NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: program_fund_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_fund_sources (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    program_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: program_required_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_required_documents (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    program_id uuid NOT NULL,
    document_key character varying(100) NOT NULL,
    mandatory boolean,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: program_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_services (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    program_id uuid NOT NULL,
    intervention_type text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.programs (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    name text NOT NULL,
    category text,
    approval_workflow jsonb,
    form_template jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    program_type text,
    legal_basis text,
    form_version integer DEFAULT 1
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    coordinator_id uuid NOT NULL,
    barangay text NOT NULL,
    surname text,
    first_name text,
    middle_name text,
    extension text,
    gender text,
    dob date,
    address jsonb,
    phone text,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text,
    decline_reason text,
    case_id uuid,
    person_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT referrals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
);


--
-- Name: reminder_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reminder_settings (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    scope character varying(16) NOT NULL,
    user_id uuid,
    event_type character varying(32) NOT NULL,
    offsets jsonb NOT NULL,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT reminder_settings_check CHECK (((((scope)::text = 'system'::text) AND (user_id IS NULL)) OR (((scope)::text = 'worker'::text) AND (user_id IS NOT NULL)))),
    CONSTRAINT reminder_settings_scope_check CHECK (((scope)::text = ANY ((ARRAY['system'::character varying, 'worker'::character varying])::text[])))
);


--
-- Name: sync_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_queue (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    device_id text NOT NULL,
    table_name text NOT NULL,
    record_id text NOT NULL,
    operation text NOT NULL,
    payload jsonb,
    client_updated_at timestamp without time zone,
    status text DEFAULT 'pending'::text,
    idempotency_key text,
    conflict_reason text,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: team_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_invites (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL,
    invite_date date NOT NULL,
    block_type character varying(32) NOT NULL,
    note text,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone
);


--
-- Name: team_schedule_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_schedule_blocks (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    user_id uuid NOT NULL,
    block_date date NOT NULL,
    block_type character varying(32) NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    note text,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source character varying(32) DEFAULT 'manual'::character varying NOT NULL,
    source_ref uuid,
    visible_to character varying(32) DEFAULT 'team'::character varying NOT NULL,
    end_date date,
    CONSTRAINT chk_team_schedule_blocks_end_date CHECK (((end_date IS NULL) OR (end_date >= block_date)))
);


--
-- Name: team_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_status (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    user_id uuid NOT NULL,
    status character varying(32) NOT NULL,
    note text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    visible_to character varying(32) DEFAULT 'team'::character varying NOT NULL
);


--
-- Name: user_barangay_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_barangay_assignments (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    user_id uuid NOT NULL,
    barangay character varying(255) NOT NULL,
    is_primary boolean,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tokens (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    user_id uuid NOT NULL,
    purpose character varying(50) NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    meta jsonb
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'social_worker'::text,
    first_name text,
    middle_name text,
    last_name text,
    name_extension text,
    phone text,
    is_active boolean DEFAULT true,
    device_id text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    person_id uuid,
    pending_person_id uuid,
    person_link_code character varying,
    person_link_code_expires_at timestamp without time zone,
    mfa_secret character varying,
    mfa_enabled boolean DEFAULT false,
    mfa_method character varying,
    email_otp_code character varying,
    email_otp_expires_at timestamp without time zone,
    token_version integer DEFAULT 0,
    email_verified boolean DEFAULT true,
    must_change_password boolean DEFAULT false NOT NULL,
    agency_id uuid
);


--
-- Name: version_vectors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.version_vectors (
    id uuid DEFAULT public.uuid_generate_v7() NOT NULL,
    device_id text NOT NULL,
    table_name text NOT NULL,
    local_version integer DEFAULT 0,
    server_version integer DEFAULT 0,
    last_synced_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: access_card_seq id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_card_seq ALTER COLUMN id SET DEFAULT nextval('public.access_card_seq_id_seq'::regclass);


--
-- Name: irf_blotter_seq id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.irf_blotter_seq ALTER COLUMN id SET DEFAULT nextval('public.irf_blotter_seq_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: case_history PK_case_history; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_history
    ADD CONSTRAINT "PK_case_history" PRIMARY KEY (id);


--
-- Name: access_card_seq access_card_seq_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_card_seq
    ADD CONSTRAINT access_card_seq_pkey PRIMARY KEY (id);


--
-- Name: access_card_services access_card_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_card_services
    ADD CONSTRAINT access_card_services_pkey PRIMARY KEY (id);


--
-- Name: agencies agencies_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_code_key UNIQUE (code);


--
-- Name: agencies agencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_pkey PRIMARY KEY (id);


--
-- Name: agency_contacts agency_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_contacts
    ADD CONSTRAINT agency_contacts_pkey PRIMARY KEY (id);


--
-- Name: analysis_run_clusters analysis_run_clusters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_run_clusters
    ADD CONSTRAINT analysis_run_clusters_pkey PRIMARY KEY (id);


--
-- Name: analysis_run_members analysis_run_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_run_members
    ADD CONSTRAINT analysis_run_members_pkey PRIMARY KEY (id);


--
-- Name: analysis_runs analysis_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_runs
    ADD CONSTRAINT analysis_runs_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_slug_key UNIQUE (slug);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: beneficiaries beneficiaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaries
    ADD CONSTRAINT beneficiaries_pkey PRIMARY KEY (id);


--
-- Name: beneficiary_claimants beneficiary_claimants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_claimants
    ADD CONSTRAINT beneficiary_claimants_pkey PRIMARY KEY (id);


--
-- Name: beneficiary_roles beneficiary_roles_access_card_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_roles
    ADD CONSTRAINT beneficiary_roles_access_card_code_key UNIQUE (access_card_code);


--
-- Name: beneficiary_roles beneficiary_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_roles
    ADD CONSTRAINT beneficiary_roles_pkey PRIMARY KEY (id);


--
-- Name: case_assistances case_assistances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assistances
    ADD CONSTRAINT case_assistances_pkey PRIMARY KEY (id);


--
-- Name: case_compliance_items case_compliance_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_compliance_items
    ADD CONSTRAINT case_compliance_items_pkey PRIMARY KEY (id);


--
-- Name: case_control_counters case_control_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_control_counters
    ADD CONSTRAINT case_control_counters_pkey PRIMARY KEY (year);


--
-- Name: case_event_reminders case_event_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_event_reminders
    ADD CONSTRAINT case_event_reminders_pkey PRIMARY KEY (id);


--
-- Name: case_events case_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_events
    ADD CONSTRAINT case_events_pkey PRIMARY KEY (id);


--
-- Name: case_follow_up_visits case_follow_up_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_follow_up_visits
    ADD CONSTRAINT case_follow_up_visits_pkey PRIMARY KEY (id);


--
-- Name: case_interventions case_interventions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_interventions
    ADD CONSTRAINT case_interventions_pkey PRIMARY KEY (id);


--
-- Name: case_payouts case_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_payouts
    ADD CONSTRAINT case_payouts_pkey PRIMARY KEY (id);


--
-- Name: case_referrals case_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_referrals
    ADD CONSTRAINT case_referrals_pkey PRIMARY KEY (id);


--
-- Name: case_requirements case_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_requirements
    ADD CONSTRAINT case_requirements_pkey PRIMARY KEY (id);


--
-- Name: case_step_locks case_step_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_step_locks
    ADD CONSTRAINT case_step_locks_pkey PRIMARY KEY (id);


--
-- Name: cases cases_control_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_control_no_key UNIQUE (control_no);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: consent_ledger consent_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_ledger
    ADD CONSTRAINT consent_ledger_pkey PRIMARY KEY (id);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);


--
-- Name: csr_reports csr_reports_control_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csr_reports
    ADD CONSTRAINT csr_reports_control_no_key UNIQUE (control_no);


--
-- Name: csr_reports csr_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csr_reports
    ADD CONSTRAINT csr_reports_pkey PRIMARY KEY (id);


--
-- Name: document_vault document_vault_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_vault
    ADD CONSTRAINT document_vault_pkey PRIMARY KEY (id);


--
-- Name: form_version_history form_version_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_version_history
    ADD CONSTRAINT form_version_history_pkey PRIMARY KEY (id);


--
-- Name: household_memberships household_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_memberships
    ADD CONSTRAINT household_memberships_pkey PRIMARY KEY (id);


--
-- Name: households households_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.households
    ADD CONSTRAINT households_pkey PRIMARY KEY (id);


--
-- Name: idempotency_keys idempotency_keys_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_key_key UNIQUE (key);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: inter_agency_referrals inter_agency_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_agency_referrals
    ADD CONSTRAINT inter_agency_referrals_pkey PRIMARY KEY (id);


--
-- Name: intervention_required_documents intervention_required_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervention_required_documents
    ADD CONSTRAINT intervention_required_documents_pkey PRIMARY KEY (id);


--
-- Name: irf_blotter_seq irf_blotter_seq_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.irf_blotter_seq
    ADD CONSTRAINT irf_blotter_seq_pkey PRIMARY KEY (id);


--
-- Name: irf_cases irf_cases_blotter_entry_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.irf_cases
    ADD CONSTRAINT irf_cases_blotter_entry_number_key UNIQUE (blotter_entry_number);


--
-- Name: irf_cases irf_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.irf_cases
    ADD CONSTRAINT irf_cases_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: office_events office_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_events
    ADD CONSTRAINT office_events_pkey PRIMARY KEY (id);


--
-- Name: otp_codes otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (id);


--
-- Name: person_addresses person_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_addresses
    ADD CONSTRAINT person_addresses_pkey PRIMARY KEY (id);


--
-- Name: person_contacts person_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_contacts
    ADD CONSTRAINT person_contacts_pkey PRIMARY KEY (id);


--
-- Name: persons persons_philsys_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_philsys_number_key UNIQUE (philsys_number);


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (id);


--
-- Name: program_enrollments program_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT program_enrollments_pkey PRIMARY KEY (id);


--
-- Name: program_fund_sources program_fund_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_fund_sources
    ADD CONSTRAINT program_fund_sources_pkey PRIMARY KEY (id);


--
-- Name: program_required_documents program_required_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_required_documents
    ADD CONSTRAINT program_required_documents_pkey PRIMARY KEY (id);


--
-- Name: program_services program_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_services
    ADD CONSTRAINT program_services_pkey PRIMARY KEY (id);


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: reminder_settings reminder_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder_settings
    ADD CONSTRAINT reminder_settings_pkey PRIMARY KEY (id);


--
-- Name: sync_queue sync_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_queue
    ADD CONSTRAINT sync_queue_pkey PRIMARY KEY (id);


--
-- Name: team_invites team_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invites
    ADD CONSTRAINT team_invites_pkey PRIMARY KEY (id);


--
-- Name: team_schedule_blocks team_schedule_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_schedule_blocks
    ADD CONSTRAINT team_schedule_blocks_pkey PRIMARY KEY (id);


--
-- Name: team_status team_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_status
    ADD CONSTRAINT team_status_pkey PRIMARY KEY (id);


--
-- Name: team_status team_status_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_status
    ADD CONSTRAINT team_status_user_id_key UNIQUE (user_id);


--
-- Name: case_step_locks uq_case_step_locks_case_step_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_step_locks
    ADD CONSTRAINT uq_case_step_locks_case_step_key UNIQUE (case_id, step_key);


--
-- Name: program_enrollments uq_program_enrollments_case_program; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT uq_program_enrollments_case_program UNIQUE (case_id, program_id);


--
-- Name: program_services uq_program_services_program_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_services
    ADD CONSTRAINT uq_program_services_program_type UNIQUE (program_id, intervention_type);


--
-- Name: user_barangay_assignments user_barangay_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_barangay_assignments
    ADD CONSTRAINT user_barangay_assignments_pkey PRIMARY KEY (id);


--
-- Name: user_tokens user_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tokens
    ADD CONSTRAINT user_tokens_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: version_vectors version_vectors_device_id_table_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.version_vectors
    ADD CONSTRAINT version_vectors_device_id_table_name_key UNIQUE (device_id, table_name);


--
-- Name: version_vectors version_vectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.version_vectors
    ADD CONSTRAINT version_vectors_pkey PRIMARY KEY (id);


--
-- Name: idx_acs_agency_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acs_agency_date ON public.access_card_services USING btree (agency_id, service_date);


--
-- Name: idx_acs_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acs_code ON public.access_card_services USING btree (access_card_code);


--
-- Name: idx_acs_intervention; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acs_intervention ON public.access_card_services USING btree (intervention_id);


--
-- Name: idx_agency_contacts_agency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agency_contacts_agency ON public.agency_contacts USING btree (agency_id);


--
-- Name: idx_audit_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_action ON public.audit_log USING btree (action);


--
-- Name: idx_audit_log_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_reference ON public.audit_log USING btree (reference_id);


--
-- Name: idx_bc_beneficiary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_beneficiary ON public.beneficiary_claimants USING btree (beneficiary_id);


--
-- Name: idx_bc_claimant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bc_claimant ON public.beneficiary_claimants USING btree (claimant_id);


--
-- Name: idx_bc_unique_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_bc_unique_primary ON public.beneficiary_claimants USING btree (beneficiary_id, claimant_id);


--
-- Name: idx_beneficiary_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beneficiary_person ON public.beneficiaries USING btree (person_id);


--
-- Name: idx_beneficiary_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beneficiary_user ON public.beneficiaries USING btree (user_id);


--
-- Name: idx_blocks_source_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_source_ref ON public.team_schedule_blocks USING btree (source_ref);


--
-- Name: idx_case_assistances_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assistances_case ON public.case_assistances USING btree (case_id);


--
-- Name: idx_case_control; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_control ON public.cases USING btree (control_no);


--
-- Name: idx_case_events_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_events_case ON public.case_events USING btree (case_id);


--
-- Name: idx_case_events_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_events_date ON public.case_events USING btree (event_date);


--
-- Name: idx_case_events_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_events_status_date ON public.case_events USING btree (status, event_date);


--
-- Name: idx_case_follow_up_visits_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_follow_up_visits_case ON public.case_follow_up_visits USING btree (case_id);


--
-- Name: idx_case_history_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_history_case ON public.case_history USING btree (case_id);


--
-- Name: idx_case_interventions_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_interventions_case ON public.case_interventions USING btree (case_id);


--
-- Name: idx_case_referrals_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_referrals_case ON public.case_referrals USING btree (case_id);


--
-- Name: idx_case_requirements_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_requirements_case ON public.case_requirements USING btree (case_id);


--
-- Name: idx_case_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_status ON public.cases USING btree (status);


--
-- Name: idx_case_step_locks_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_step_locks_case ON public.case_step_locks USING btree (case_id);


--
-- Name: idx_cases_beneficiary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_beneficiary ON public.cases USING btree (beneficiary_id);


--
-- Name: idx_cases_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_status_created ON public.cases USING btree (status, created_at);


--
-- Name: idx_cases_worker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_worker ON public.cases USING btree (assigned_worker_id);


--
-- Name: idx_chat_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conversation ON public.chat_messages USING btree (conversation_id);


--
-- Name: idx_chat_participants; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_participants ON public.chat_messages USING btree (sender_id, recipient_id);


--
-- Name: idx_compliance_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_case ON public.case_compliance_items USING btree (case_id);


--
-- Name: idx_compliance_dedupe; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_compliance_dedupe ON public.case_compliance_items USING btree (case_id, household_member_id, compliance_type, due_date);


--
-- Name: idx_compliance_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_due ON public.case_compliance_items USING btree (due_date);


--
-- Name: idx_consent_beneficiary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_beneficiary ON public.consent_ledger USING btree (beneficiary_id);


--
-- Name: idx_consent_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_status ON public.consent_ledger USING btree (status);


--
-- Name: idx_contact_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_messages_created_at ON public.contact_messages USING btree (created_at DESC);


--
-- Name: idx_csr_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csr_case ON public.csr_reports USING btree (case_id);


--
-- Name: idx_csr_control; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csr_control ON public.csr_reports USING btree (control_no);


--
-- Name: idx_doc_announcement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_announcement ON public.document_vault USING btree (announcement_id);


--
-- Name: idx_doc_beneficiary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_beneficiary ON public.document_vault USING btree (beneficiary_id);


--
-- Name: idx_doc_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_case ON public.document_vault USING btree (case_id);


--
-- Name: idx_doc_irf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_irf ON public.document_vault USING btree (irf_id);


--
-- Name: idx_hm_household; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hm_household ON public.household_memberships USING btree (household_id);


--
-- Name: idx_hm_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hm_person ON public.household_memberships USING btree (person_id);


--
-- Name: idx_household_nhts; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_household_nhts ON public.households USING btree (nhts_pr_id) WHERE (nhts_pr_id IS NOT NULL);


--
-- Name: idx_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_key ON public.idempotency_keys USING btree (key);


--
-- Name: idx_inter_referral_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inter_referral_case ON public.inter_agency_referrals USING btree (case_id);


--
-- Name: idx_inter_referral_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inter_referral_from ON public.inter_agency_referrals USING btree (from_agency_id);


--
-- Name: idx_inter_referral_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inter_referral_person ON public.inter_agency_referrals USING btree (person_id);


--
-- Name: idx_inter_referral_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inter_referral_status ON public.inter_agency_referrals USING btree (status);


--
-- Name: idx_inter_referral_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inter_referral_to ON public.inter_agency_referrals USING btree (to_agency_id);


--
-- Name: idx_irf_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_irf_created ON public.irf_cases USING btree (created_at);


--
-- Name: idx_notif_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_read ON public.notifications USING btree (recipient_id, is_read);


--
-- Name: idx_notif_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_recipient ON public.notifications USING btree (recipient_id);


--
-- Name: idx_office_events_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_events_start ON public.office_events USING btree (starts_at);


--
-- Name: idx_otp_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_expires ON public.otp_codes USING btree (expires_at);


--
-- Name: idx_otp_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_phone ON public.otp_codes USING btree (phone);


--
-- Name: idx_payout_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_case ON public.case_payouts USING btree (case_id);


--
-- Name: idx_payout_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_date ON public.case_payouts USING btree (scheduled_at);


--
-- Name: idx_payout_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_status ON public.case_payouts USING btree (status);


--
-- Name: idx_person_addresses_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_addresses_person ON public.person_addresses USING btree (person_id);


--
-- Name: idx_person_contacts_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_contacts_person ON public.person_contacts USING btree (person_id);


--
-- Name: idx_person_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_name_trgm ON public.persons USING gin (surname public.gin_trgm_ops, first_name public.gin_trgm_ops);


--
-- Name: idx_person_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_search ON public.persons USING gin (search_vector);


--
-- Name: idx_program_docs_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_docs_program ON public.program_required_documents USING btree (program_id);


--
-- Name: idx_program_enrollments_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_enrollments_case ON public.program_enrollments USING btree (case_id);


--
-- Name: idx_program_funds_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_funds_program ON public.program_fund_sources USING btree (program_id);


--
-- Name: idx_program_services_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_services_program ON public.program_services USING btree (program_id);


--
-- Name: idx_referral_barangay; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_barangay ON public.referrals USING btree (barangay);


--
-- Name: idx_referral_coordinator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_coordinator ON public.referrals USING btree (coordinator_id);


--
-- Name: idx_referral_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_person ON public.referrals USING btree (person_id);


--
-- Name: idx_referral_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_status ON public.referrals USING btree (status);


--
-- Name: idx_run_cluster_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_run_cluster_run ON public.analysis_run_clusters USING btree (run_id, cluster_index);


--
-- Name: idx_run_member_cluster; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_run_member_cluster ON public.analysis_run_members USING btree (run_id, cluster_index);


--
-- Name: idx_run_member_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_run_member_unique ON public.analysis_run_members USING btree (run_id, household_id);


--
-- Name: idx_runs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runs_created ON public.analysis_runs USING btree (created_at DESC);


--
-- Name: idx_sync_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_device ON public.sync_queue USING btree (device_id);


--
-- Name: idx_sync_device_idemp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_device_idemp ON public.sync_queue USING btree (device_id, idempotency_key);


--
-- Name: idx_sync_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_status ON public.sync_queue USING btree (status);


--
-- Name: idx_team_blocks_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_blocks_user_date ON public.team_schedule_blocks USING btree (user_id, block_date);


--
-- Name: idx_team_invites_to_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_invites_to_status ON public.team_invites USING btree (to_user_id, status);


--
-- Name: idx_user_agency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_agency ON public.users USING btree (agency_id);


--
-- Name: idx_user_barangay_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_barangay_user ON public.user_barangay_assignments USING btree (user_id);


--
-- Name: idx_user_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_person ON public.users USING btree (person_id);


--
-- Name: idx_user_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tokens_user ON public.user_tokens USING btree (user_id);


--
-- Name: uq_beneficiary_roles_access_card_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_beneficiary_roles_access_card_code ON public.beneficiary_roles USING btree (access_card_code) WHERE (access_card_code IS NOT NULL);


--
-- Name: uq_case_event_reminders; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_case_event_reminders ON public.case_event_reminders USING btree (event_id, offset_minutes, channel);


--
-- Name: uq_case_requirements_case_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_case_requirements_case_key ON public.case_requirements USING btree (case_id, requirement_key);


--
-- Name: uq_households_access_card_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_households_access_card_code ON public.households USING btree (access_card_code) WHERE (access_card_code IS NOT NULL);


--
-- Name: uq_intervention_documents; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_intervention_documents ON public.intervention_required_documents USING btree (intervention_type, document_key);


--
-- Name: uq_reminder_system_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_reminder_system_type ON public.reminder_settings USING btree (event_type) WHERE ((scope)::text = 'system'::text);


--
-- Name: uq_reminder_worker_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_reminder_worker_type ON public.reminder_settings USING btree (user_id, event_type) WHERE ((scope)::text = 'worker'::text);


--
-- Name: uq_team_invites_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_team_invites_pending ON public.team_invites USING btree (from_user_id, to_user_id, invite_date) WHERE ((status)::text = 'pending'::text);


--
-- Name: beneficiaries hash_chain_tg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER hash_chain_tg BEFORE INSERT OR UPDATE ON public.beneficiaries FOR EACH ROW WHEN ((new.hash IS NULL)) EXECUTE FUNCTION public.hash_chain_tg_beneficiaries();


--
-- Name: cases hash_chain_tg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER hash_chain_tg BEFORE INSERT OR UPDATE ON public.cases FOR EACH ROW WHEN ((new.hash IS NULL)) EXECUTE FUNCTION public.hash_chain_tg_cases();


--
-- Name: consent_ledger hash_chain_tg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER hash_chain_tg BEFORE INSERT OR UPDATE ON public.consent_ledger FOR EACH ROW WHEN ((new.hash IS NULL)) EXECUTE FUNCTION public.hash_chain_tg_consent_ledger();


--
-- Name: access_card_services access_card_services_logged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_card_services
    ADD CONSTRAINT access_card_services_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES public.users(id);


--
-- Name: analysis_run_clusters analysis_run_clusters_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_run_clusters
    ADD CONSTRAINT analysis_run_clusters_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.analysis_runs(id) ON DELETE CASCADE;


--
-- Name: analysis_run_members analysis_run_members_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_run_members
    ADD CONSTRAINT analysis_run_members_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: analysis_run_members analysis_run_members_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_run_members
    ADD CONSTRAINT analysis_run_members_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.analysis_runs(id) ON DELETE CASCADE;


--
-- Name: analysis_runs analysis_runs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_runs
    ADD CONSTRAINT analysis_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: announcements announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: beneficiary_claimants beneficiary_claimants_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_claimants
    ADD CONSTRAINT beneficiary_claimants_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.persons(id);


--
-- Name: beneficiary_claimants beneficiary_claimants_claimant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_claimants
    ADD CONSTRAINT beneficiary_claimants_claimant_id_fkey FOREIGN KEY (claimant_id) REFERENCES public.persons(id);


--
-- Name: beneficiary_roles beneficiary_roles_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_roles
    ADD CONSTRAINT beneficiary_roles_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: case_compliance_items case_compliance_items_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_compliance_items
    ADD CONSTRAINT case_compliance_items_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id);


--
-- Name: case_compliance_items case_compliance_items_household_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_compliance_items
    ADD CONSTRAINT case_compliance_items_household_member_id_fkey FOREIGN KEY (household_member_id) REFERENCES public.persons(id);


--
-- Name: case_compliance_items case_compliance_items_met_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_compliance_items
    ADD CONSTRAINT case_compliance_items_met_by_fkey FOREIGN KEY (met_by) REFERENCES public.users(id);


--
-- Name: case_event_reminders case_event_reminders_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_event_reminders
    ADD CONSTRAINT case_event_reminders_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.case_events(id) ON DELETE CASCADE;


--
-- Name: case_events case_events_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_events
    ADD CONSTRAINT case_events_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_events case_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_events
    ADD CONSTRAINT case_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: case_interventions case_interventions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_interventions
    ADD CONSTRAINT case_interventions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: case_payouts case_payouts_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_payouts
    ADD CONSTRAINT case_payouts_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id);


--
-- Name: case_payouts case_payouts_notified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_payouts
    ADD CONSTRAINT case_payouts_notified_by_fkey FOREIGN KEY (notified_by) REFERENCES public.users(id);


--
-- Name: case_referrals case_referrals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_referrals
    ADD CONSTRAINT case_referrals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: cases cases_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id);


--
-- Name: team_schedule_blocks fk_blocks_source_ref; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_schedule_blocks
    ADD CONSTRAINT fk_blocks_source_ref FOREIGN KEY (source_ref) REFERENCES public.case_events(id) ON DELETE SET NULL;


--
-- Name: form_version_history form_version_history_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_version_history
    ADD CONSTRAINT form_version_history_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;


--
-- Name: household_memberships household_memberships_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_memberships
    ADD CONSTRAINT household_memberships_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: household_memberships household_memberships_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_memberships
    ADD CONSTRAINT household_memberships_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: households households_primary_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.households
    ADD CONSTRAINT households_primary_beneficiary_id_fkey FOREIGN KEY (primary_beneficiary_id) REFERENCES public.beneficiaries(id);


--
-- Name: inter_agency_referrals inter_agency_referrals_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_agency_referrals
    ADD CONSTRAINT inter_agency_referrals_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id);


--
-- Name: inter_agency_referrals inter_agency_referrals_consent_ledger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_agency_referrals
    ADD CONSTRAINT inter_agency_referrals_consent_ledger_id_fkey FOREIGN KEY (consent_ledger_id) REFERENCES public.consent_ledger(id);


--
-- Name: inter_agency_referrals inter_agency_referrals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_agency_referrals
    ADD CONSTRAINT inter_agency_referrals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: inter_agency_referrals inter_agency_referrals_from_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_agency_referrals
    ADD CONSTRAINT inter_agency_referrals_from_agency_id_fkey FOREIGN KEY (from_agency_id) REFERENCES public.agencies(id);


--
-- Name: inter_agency_referrals inter_agency_referrals_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_agency_referrals
    ADD CONSTRAINT inter_agency_referrals_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: inter_agency_referrals inter_agency_referrals_to_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_agency_referrals
    ADD CONSTRAINT inter_agency_referrals_to_agency_id_fkey FOREIGN KEY (to_agency_id) REFERENCES public.agencies(id);


--
-- Name: irf_cases irf_cases_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.irf_cases
    ADD CONSTRAINT irf_cases_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id);


--
-- Name: office_events office_events_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_events
    ADD CONSTRAINT office_events_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: program_enrollments program_enrollments_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT program_enrollments_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id);


--
-- Name: program_enrollments program_enrollments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT program_enrollments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: program_enrollments program_enrollments_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT program_enrollments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id);


--
-- Name: program_services program_services_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_services
    ADD CONSTRAINT program_services_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id);


--
-- Name: referrals referrals_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id);


--
-- Name: referrals referrals_coordinator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_coordinator_id_fkey FOREIGN KEY (coordinator_id) REFERENCES public.users(id);


--
-- Name: referrals referrals_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: reminder_settings reminder_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder_settings
    ADD CONSTRAINT reminder_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: reminder_settings reminder_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder_settings
    ADD CONSTRAINT reminder_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: team_invites team_invites_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invites
    ADD CONSTRAINT team_invites_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id);


--
-- Name: team_invites team_invites_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invites
    ADD CONSTRAINT team_invites_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users(id);


--
-- Name: team_schedule_blocks team_schedule_blocks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_schedule_blocks
    ADD CONSTRAINT team_schedule_blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: team_schedule_blocks team_schedule_blocks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_schedule_blocks
    ADD CONSTRAINT team_schedule_blocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: team_status team_status_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_status
    ADD CONSTRAINT team_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies(id);


--
-- Name: users users_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: beneficiaries ben_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ben_admin_all ON public.beneficiaries USING ((current_setting('app.current_role'::text) = 'admin'::text));


--
-- Name: beneficiaries ben_barangay_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ben_barangay_scope ON public.beneficiaries USING (((current_setting('app.current_role'::text) = ANY (ARRAY['social_worker'::text, 'coordinator'::text])) AND ((current_setting('app.current_barangay'::text) = ''::text) OR (EXISTS ( SELECT 1
   FROM public.person_addresses pa
  WHERE ((pa.person_id = beneficiaries.person_id) AND (((pa.barangay)::text ~~* (('%'::text || current_setting('app.current_barangay'::text)) || '%'::text)) OR (pa.raw ~~* (('%'::text || current_setting('app.current_barangay'::text)) || '%'::text)))))))));


--
-- Name: beneficiaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;

--
-- Name: cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

--
-- Name: cases cases_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cases_admin_all ON public.cases USING ((current_setting('app.current_role'::text) = 'admin'::text));


--
-- Name: cases cases_barangay_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cases_barangay_scope ON public.cases USING (((current_setting('app.current_role'::text) = ANY (ARRAY['social_worker'::text, 'coordinator'::text])) AND (EXISTS ( SELECT 1
   FROM (public.beneficiaries b
     JOIN public.persons p ON ((p.id = b.person_id)))
  WHERE ((b.id = cases.beneficiary_id) AND ((current_setting('app.current_barangay'::text) = ''::text) OR (EXISTS ( SELECT 1
           FROM public.person_addresses pa
          WHERE ((pa.person_id = p.id) AND (((pa.barangay)::text ~~* (('%'::text || current_setting('app.current_barangay'::text)) || '%'::text)) OR (pa.raw ~~* (('%'::text || current_setting('app.current_barangay'::text)) || '%'::text))))))))))));


--
-- Name: consent_ledger consent_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY consent_admin_all ON public.consent_ledger USING ((current_setting('app.current_role'::text) = 'admin'::text));


--
-- Name: consent_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_ledger consent_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY consent_self ON public.consent_ledger FOR SELECT USING (((current_setting('app.current_role'::text) = 'social_worker'::text) AND (beneficiary_id IS NOT NULL)));


--
-- Name: irf_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.irf_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: persons rls_barangay_persons_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_barangay_persons_select ON public.persons FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.person_addresses pa
  WHERE ((pa.person_id = persons.id) AND (((pa.barangay)::text ~~* (('%'::text || current_setting('app.current_barangay'::text, true)) || '%'::text)) OR (pa.raw ~~* (('%'::text || current_setting('app.current_barangay'::text, true)) || '%'::text)))))));


--
-- PostgreSQL database dump complete
--


