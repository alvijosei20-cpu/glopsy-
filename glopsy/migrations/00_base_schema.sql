--
-- PostgreSQL database dump
--

\restrict ech9wD1nIhSvgBkdGP7ACBo0k1ZfLzORIq28Bv6JfpySyz4DJUugeWESbE8EfwR

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id integer NOT NULL,
    user_id integer NOT NULL,
    ip character varying(255) CONSTRAINT api_keys_nombre_cliente_not_null NOT NULL,
    api_key character varying(255) NOT NULL,
    activo smallint DEFAULT 1 NOT NULL,
    fecha timestamp without time zone NOT NULL
);


--
-- Name: api_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.api_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: api_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.api_keys_id_seq OWNED BY public.api_keys.id;


--
-- Name: categorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias (
    id integer NOT NULL,
    tienda_id bigint,
    nombre character varying(100) NOT NULL,
    descripcion text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categorias_id_seq OWNED BY public.categorias.id;


--
-- Name: checkout_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkout_integrations (
    id integer NOT NULL,
    tienda_id bigint NOT NULL,
    provider character varying(50) NOT NULL,
    public_key text,
    access_token text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    mode character varying(20) DEFAULT 'prueba'::character varying NOT NULL,
    webhook_secret text
);


--
-- Name: chackout_inte; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.chackout_inte AS
 SELECT id,
    tienda_id,
    provider,
    mode,
    public_key,
    access_token,
    webhook_secret,
    created_at,
    updated_at
   FROM public.checkout_integrations;


--
-- Name: checkout_integrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checkout_integrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: checkout_integrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checkout_integrations_id_seq OWNED BY public.checkout_integrations.id;


--
-- Name: ciudades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ciudades (
    id integer NOT NULL,
    departamento_id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    codigo_postal character varying(20),
    codigo_dane character varying(20)
);


--
-- Name: ciudades_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ciudades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ciudades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ciudades_id_seq OWNED BY public.ciudades.id;


--
-- Name: departamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departamentos (
    id integer NOT NULL,
    pais_id integer NOT NULL,
    nombre character varying(100) NOT NULL
);


--
-- Name: departamentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.departamentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: departamentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.departamentos_id_seq OWNED BY public.departamentos.id;


--
-- Name: favoritos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favoritos (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    product_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: favoritos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.favoritos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: favoritos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.favoritos_id_seq OWNED BY public.favoritos.id;


--
-- Name: fullments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fullments (
    id integer NOT NULL,
    ciudad_id integer NOT NULL,
    estado character varying(50) DEFAULT 'activo'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tienda_id bigint
);


--
-- Name: fullments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fullments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fullments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fullments_id_seq OWNED BY public.fullments.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id bigint,
    guest_hash text,
    order_id bigint,
    type character varying(60) NOT NULL,
    title character varying(160) NOT NULL,
    message text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    event_key character varying(180),
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_recipient_check CHECK (((user_id IS NOT NULL) OR (guest_hash IS NOT NULL)))
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: oferta_productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oferta_productos (
    oferta_id integer NOT NULL,
    producto_id integer NOT NULL
);


--
-- Name: ofertas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ofertas (
    id integer NOT NULL,
    tienda_id bigint NOT NULL,
    titulo character varying(150) NOT NULL,
    descripcion text,
    tipo_descuento character varying(20) NOT NULL,
    valor_descuento numeric(10,2) DEFAULT 0.00 NOT NULL,
    alcance character varying(20) NOT NULL,
    ciudad_id integer,
    fecha_inicio timestamp with time zone,
    fecha_fin timestamp with time zone,
    estado character varying(50) DEFAULT 'activo'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ofertas_alcance_check CHECK (((alcance)::text = ANY ((ARRAY['global'::character varying, 'productos'::character varying, 'ciudad'::character varying])::text[]))),
    CONSTRAINT ofertas_tipo_descuento_check CHECK (((tipo_descuento)::text = ANY ((ARRAY['porcentaje'::character varying, 'monto_fijo'::character varying])::text[])))
);


--
-- Name: ofertas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ofertas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ofertas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ofertas_id_seq OWNED BY public.ofertas.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer,
    tienda_integracion_id integer,
    product_name text NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    line_total numeric(12,2) DEFAULT 0 NOT NULL,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now(),
    shipment_id integer,
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: order_shipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_shipments (
    id integer NOT NULL,
    order_id integer NOT NULL,
    shipment_number integer NOT NULL,
    carrier text,
    service text,
    shipping_cost numeric(12,2) DEFAULT 0 NOT NULL,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now(),
    group_key text,
    idbusiness text,
    origin_ciudad_id integer,
    destination_ciudad_id integer,
    tracking_code text,
    mastershop_status_id integer,
    shipping_url text,
    fulfillment_status character varying(50) DEFAULT 'pending'::character varying,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_shipments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_shipments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_shipments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_shipments_id_seq OWNED BY public.order_shipments.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    tienda_id bigint,
    user_id bigint,
    guest_hash text,
    preference_id text,
    mercadopago_payment_id text,
    status character varying(50) NOT NULL,
    amount numeric(12,2) DEFAULT 0,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now(),
    departamento_id integer,
    ciudad_id integer,
    direccion text,
    telefono character varying(40),
    shipping_cost numeric(12,2) DEFAULT 0 NOT NULL,
    shipping_payload jsonb,
    customer_name character varying(150),
    identification_type character varying(10),
    identification_number character varying(40),
    fulfillment_status character varying(40) DEFAULT 'pending'::character varying NOT NULL,
    fulfillment_error text,
    fulfillment_attempts integer DEFAULT 0 NOT NULL,
    fulfillment_updated_at timestamp with time zone DEFAULT now(),
    tracking_code text,
    carrier text,
    mastershop_status_id integer,
    shipping_url text,
    order_hash character varying(64) NOT NULL,
    order_number character varying(20),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: pagos_exitosos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_exitosos (
    id integer NOT NULL,
    order_id integer NOT NULL,
    tienda_integracion_id integer NOT NULL,
    provider character varying(50) NOT NULL,
    external_order_id text,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    request_payload jsonb,
    response_payload jsonb,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: pagos_exitosos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_exitosos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_exitosos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_exitosos_id_seq OWNED BY public.pagos_exitosos.id;


--
-- Name: paises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paises (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    codigo_iso character varying(10)
);


--
-- Name: paises_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.paises_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: paises_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.paises_id_seq OWNED BY public.paises.id;


--
-- Name: perfiles_envio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.perfiles_envio (
    id integer NOT NULL,
    tienda_id bigint NOT NULL,
    nombre character varying(150) NOT NULL,
    tipo_envio character varying(20) NOT NULL,
    alcance character varying(20) NOT NULL,
    costo numeric(10,2) DEFAULT 0.00 NOT NULL,
    estado character varying(50) DEFAULT 'activo'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    fullment_id integer,
    ciudad_id integer,
    CONSTRAINT perfiles_envio_alcance_check CHECK (((alcance)::text = ANY ((ARRAY['global'::character varying, 'ciudad'::character varying])::text[]))),
    CONSTRAINT perfiles_envio_tipo_envio_check CHECK (((tipo_envio)::text = ANY ((ARRAY['gratis'::character varying, 'cobro'::character varying])::text[])))
);


--
-- Name: perfiles_envio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.perfiles_envio_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: perfiles_envio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.perfiles_envio_id_seq OWNED BY public.perfiles_envio.id;


--
-- Name: produc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produc (
    id integer NOT NULL,
    tienda_id bigint NOT NULL,
    external_product_id character varying(100),
    name character varying(255) NOT NULL,
    base_price numeric(12,2) DEFAULT 0 NOT NULL,
    base_currency_price character varying(10) DEFAULT 'USD'::character varying,
    suggested_price numeric(12,2),
    description text,
    stock_total integer DEFAULT 0,
    product_owner jsonb,
    images jsonb DEFAULT '[]'::jsonb NOT NULL,
    variants jsonb DEFAULT '[]'::jsonb NOT NULL,
    warranties jsonb DEFAULT '{}'::jsonb NOT NULL,
    support jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    fullm_id integer,
    integracion_id integer,
    selected_variant_id character varying(100),
    selected_options jsonb DEFAULT '{}'::jsonb,
    categoria_id integer,
    public_id character varying(64),
    tipo_empaque_id integer,
    peso numeric(10,2),
    largo numeric(10,2),
    alto numeric(10,2),
    ancho numeric(10,2),
    perfil_envio_id integer
);


--
-- Name: produc_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.produc_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: produc_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.produc_id_seq OWNED BY public.produc.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    product_id bigint NOT NULL,
    user_id bigint NOT NULL,
    order_id bigint,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    shipment_id bigint,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: tienda_dian; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_dian (
    id integer NOT NULL,
    tienda_id bigint NOT NULL,
    sw_id character varying(255) NOT NULL,
    sw_pin character varying(255) NOT NULL,
    technical_key text NOT NULL,
    prefix character varying(50) NOT NULL,
    test_set_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tienda_dian_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tienda_dian_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tienda_dian_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tienda_dian_id_seq OWNED BY public.tienda_dian.id;


--
-- Name: tienda_integraciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_integraciones (
    id integer NOT NULL,
    user_id integer NOT NULL,
    provider character varying(50) NOT NULL,
    api_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tienda_integraciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tienda_integraciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tienda_integraciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tienda_integraciones_id_seq OWNED BY public.tienda_integraciones.id;


--
-- Name: tiendas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tiendas (
    usrid bigint CONSTRAINT users_usrid_not_null NOT NULL,
    hashid uuid DEFAULT gen_random_uuid() CONSTRAINT users_hashid_not_null NOT NULL,
    nombres character varying(100) CONSTRAINT users_nombres_not_null NOT NULL,
    fechareg timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    avatar character varying(255),
    activa boolean DEFAULT true NOT NULL
);


--
-- Name: tipo_empaque; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipo_empaque (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    peso numeric(10,2) DEFAULT 1.00 NOT NULL,
    largo numeric(10,2) DEFAULT 10.00 NOT NULL,
    alto numeric(10,2) DEFAULT 10.00 NOT NULL,
    ancho numeric(10,2) DEFAULT 10.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tipo_empaque_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tipo_empaque_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tipo_empaque_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tipo_empaque_id_seq OWNED BY public.tipo_empaque.id;


--
-- Name: tipos_empaque; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_empaque (
    id integer NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(100) NOT NULL,
    largo_cm numeric(8,2) NOT NULL,
    ancho_cm numeric(8,2) NOT NULL,
    alto_cm numeric(8,2) NOT NULL,
    peso_max_kg numeric(8,2) NOT NULL,
    peso_volumetrico_kg numeric(8,2) GENERATED ALWAYS AS ((((largo_cm * ancho_cm) * alto_cm) / (5000)::numeric)) STORED
);


--
-- Name: tipos_empaque_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tipos_empaque_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tipos_empaque_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tipos_empaque_id_seq OWNED BY public.tipos_empaque.id;


--
-- Name: user_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_addresses (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(20) NOT NULL,
    title character varying(100) NOT NULL,
    street character varying(255) NOT NULL,
    city character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    zip_code character varying(20),
    country character varying(100) DEFAULT 'Colombia'::character varying,
    phone character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT user_addresses_type_check CHECK (((type)::text = ANY ((ARRAY['original'::character varying, 'opcional'::character varying])::text[])))
);


--
-- Name: user_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_addresses_id_seq OWNED BY public.user_addresses.id;


--
-- Name: user_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_cards (
    id integer NOT NULL,
    user_id integer NOT NULL,
    card_holder character varying(255) NOT NULL,
    last_four character varying(4) NOT NULL,
    card_brand character varying(50) NOT NULL,
    expiry_month character varying(2) NOT NULL,
    expiry_year character varying(4) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    token_mp character varying(255)
);


--
-- Name: user_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_cards_id_seq OWNED BY public.user_cards.id;


--
-- Name: user_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_credentials (
    id integer NOT NULL,
    user_id integer NOT NULL,
    credential_id text NOT NULL,
    public_key text NOT NULL,
    counter bigint DEFAULT 0 NOT NULL,
    transports text[],
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_credentials_id_seq OWNED BY public.user_credentials.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(150),
    avatar_url text,
    google_id character varying(255),
    discord_id character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    phone character varying(50),
    birthdate date,
    document_type character varying(20),
    document_number character varying(50),
    gender character varying(20),
    password_hash character varying(255),
    push_subscription text,
    webauthn_credential text
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: users_usrid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_usrid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_usrid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_usrid_seq OWNED BY public.tiendas.usrid;


--
-- Name: vista_medidas_productos; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vista_medidas_productos AS
 SELECT p.id AS producto_id,
    p.external_product_id,
    p.tienda_id,
    p.name AS producto_nombre,
    p.peso AS peso_real,
    p.largo AS largo_real,
    p.alto AS alto_real,
    p.ancho AS ancho_real,
    e.id AS tipo_empaque_id,
    e.nombre AS empaque_nombre,
    e.peso AS empaque_peso,
    e.largo AS empaque_largo,
    e.alto AS empaque_alto,
    e.ancho AS empaque_ancho,
    COALESCE(p.peso, e.peso, 1.00) AS peso_final,
    COALESCE(p.largo, e.largo, 10.00) AS largo_final,
    COALESCE(p.alto, e.alto, 10.00) AS alto_final,
    COALESCE(p.ancho, e.ancho, 10.00) AS ancho_final
   FROM (public.produc p
     LEFT JOIN public.tipo_empaque e ON ((p.tipo_empaque_id = e.id)));


--
-- Name: api_keys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys ALTER COLUMN id SET DEFAULT nextval('public.api_keys_id_seq'::regclass);


--
-- Name: categorias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id SET DEFAULT nextval('public.categorias_id_seq'::regclass);


--
-- Name: checkout_integrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_integrations ALTER COLUMN id SET DEFAULT nextval('public.checkout_integrations_id_seq'::regclass);


--
-- Name: ciudades id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ciudades ALTER COLUMN id SET DEFAULT nextval('public.ciudades_id_seq'::regclass);


--
-- Name: departamentos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departamentos ALTER COLUMN id SET DEFAULT nextval('public.departamentos_id_seq'::regclass);


--
-- Name: favoritos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favoritos ALTER COLUMN id SET DEFAULT nextval('public.favoritos_id_seq'::regclass);


--
-- Name: fullments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fullments ALTER COLUMN id SET DEFAULT nextval('public.fullments_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: ofertas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ofertas ALTER COLUMN id SET DEFAULT nextval('public.ofertas_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: order_shipments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_shipments ALTER COLUMN id SET DEFAULT nextval('public.order_shipments_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: pagos_exitosos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_exitosos ALTER COLUMN id SET DEFAULT nextval('public.pagos_exitosos_id_seq'::regclass);


--
-- Name: paises id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paises ALTER COLUMN id SET DEFAULT nextval('public.paises_id_seq'::regclass);


--
-- Name: perfiles_envio id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles_envio ALTER COLUMN id SET DEFAULT nextval('public.perfiles_envio_id_seq'::regclass);


--
-- Name: produc id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produc ALTER COLUMN id SET DEFAULT nextval('public.produc_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: tienda_dian id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_dian ALTER COLUMN id SET DEFAULT nextval('public.tienda_dian_id_seq'::regclass);


--
-- Name: tienda_integraciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_integraciones ALTER COLUMN id SET DEFAULT nextval('public.tienda_integraciones_id_seq'::regclass);


--
-- Name: tiendas usrid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tiendas ALTER COLUMN usrid SET DEFAULT nextval('public.users_usrid_seq'::regclass);


--
-- Name: tipo_empaque id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipo_empaque ALTER COLUMN id SET DEFAULT nextval('public.tipo_empaque_id_seq'::regclass);


--
-- Name: tipos_empaque id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_empaque ALTER COLUMN id SET DEFAULT nextval('public.tipos_empaque_id_seq'::regclass);


--
-- Name: user_addresses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses ALTER COLUMN id SET DEFAULT nextval('public.user_addresses_id_seq'::regclass);


--
-- Name: user_cards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cards ALTER COLUMN id SET DEFAULT nextval('public.user_cards_id_seq'::regclass);


--
-- Name: user_credentials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials ALTER COLUMN id SET DEFAULT nextval('public.user_credentials_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- Name: checkout_integrations checkout_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_integrations
    ADD CONSTRAINT checkout_integrations_pkey PRIMARY KEY (id);


--
-- Name: ciudades ciudades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ciudades
    ADD CONSTRAINT ciudades_pkey PRIMARY KEY (id);


--
-- Name: departamentos departamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departamentos
    ADD CONSTRAINT departamentos_pkey PRIMARY KEY (id);


--
-- Name: favoritos favoritos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favoritos
    ADD CONSTRAINT favoritos_pkey PRIMARY KEY (id);


--
-- Name: fullments fullments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fullments
    ADD CONSTRAINT fullments_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_event_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_event_key_key UNIQUE (event_key);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: oferta_productos oferta_productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oferta_productos
    ADD CONSTRAINT oferta_productos_pkey PRIMARY KEY (oferta_id, producto_id);


--
-- Name: ofertas ofertas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ofertas
    ADD CONSTRAINT ofertas_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_shipments order_shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_shipments
    ADD CONSTRAINT order_shipments_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: pagos_exitosos pagos_exitosos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_exitosos
    ADD CONSTRAINT pagos_exitosos_pkey PRIMARY KEY (id);


--
-- Name: paises paises_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paises
    ADD CONSTRAINT paises_nombre_key UNIQUE (nombre);


--
-- Name: paises paises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paises
    ADD CONSTRAINT paises_pkey PRIMARY KEY (id);


--
-- Name: perfiles_envio perfiles_envio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles_envio
    ADD CONSTRAINT perfiles_envio_pkey PRIMARY KEY (id);


--
-- Name: produc produc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produc
    ADD CONSTRAINT produc_pkey PRIMARY KEY (id);


--
-- Name: produc produc_public_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produc
    ADD CONSTRAINT produc_public_id_key UNIQUE (public_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: tienda_dian tienda_dian_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_dian
    ADD CONSTRAINT tienda_dian_pkey PRIMARY KEY (id);


--
-- Name: tienda_integraciones tienda_integraciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_integraciones
    ADD CONSTRAINT tienda_integraciones_pkey PRIMARY KEY (id);


--
-- Name: tipo_empaque tipo_empaque_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipo_empaque
    ADD CONSTRAINT tipo_empaque_pkey PRIMARY KEY (id);


--
-- Name: tipos_empaque tipos_empaque_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_empaque
    ADD CONSTRAINT tipos_empaque_codigo_key UNIQUE (codigo);


--
-- Name: tipos_empaque tipos_empaque_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_empaque
    ADD CONSTRAINT tipos_empaque_pkey PRIMARY KEY (id);


--
-- Name: ciudades unique_ciudad_departamento; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ciudades
    ADD CONSTRAINT unique_ciudad_departamento UNIQUE (departamento_id, nombre);


--
-- Name: departamentos unique_departamento_pais; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departamentos
    ADD CONSTRAINT unique_departamento_pais UNIQUE (pais_id, nombre);


--
-- Name: orders unique_order_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT unique_order_hash UNIQUE (order_hash);


--
-- Name: pagos_exitosos unique_order_provider_integration; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_exitosos
    ADD CONSTRAINT unique_order_provider_integration UNIQUE (order_id, tienda_integracion_id);


--
-- Name: order_shipments unique_order_shipment_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_shipments
    ADD CONSTRAINT unique_order_shipment_number UNIQUE (order_id, shipment_number);


--
-- Name: checkout_integrations unique_tienda_checkout_provider_mode; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_integrations
    ADD CONSTRAINT unique_tienda_checkout_provider_mode UNIQUE (tienda_id, provider, mode);


--
-- Name: tienda_dian unique_tienda_dian; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_dian
    ADD CONSTRAINT unique_tienda_dian UNIQUE (tienda_id);


--
-- Name: favoritos unique_user_product_favorite; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favoritos
    ADD CONSTRAINT unique_user_product_favorite UNIQUE (user_id, product_id);


--
-- Name: tienda_integraciones unique_user_provider; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_integraciones
    ADD CONSTRAINT unique_user_provider UNIQUE (user_id, provider);


--
-- Name: user_addresses user_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_pkey PRIMARY KEY (id);


--
-- Name: user_cards user_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cards
    ADD CONSTRAINT user_cards_pkey PRIMARY KEY (id);


--
-- Name: user_credentials user_credentials_credential_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_credential_id_key UNIQUE (credential_id);


--
-- Name: user_credentials user_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_pkey PRIMARY KEY (id);


--
-- Name: users users_discord_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_discord_id_key UNIQUE (discord_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: tiendas users_hashid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tiendas
    ADD CONSTRAINT users_hashid_key UNIQUE (hashid);


--
-- Name: tiendas users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tiendas
    ADD CONSTRAINT users_pkey PRIMARY KEY (usrid);


--
-- Name: users users_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey1 PRIMARY KEY (id);


--
-- Name: idx_api_keys_api_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_api_key ON public.api_keys USING btree (api_key);


--
-- Name: idx_categorias_tienda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categorias_tienda_id ON public.categorias USING btree (tienda_id);


--
-- Name: idx_checkout_integrations_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_integrations_provider ON public.checkout_integrations USING btree (provider);


--
-- Name: idx_checkout_integrations_tienda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_integrations_tienda_id ON public.checkout_integrations USING btree (tienda_id);


--
-- Name: idx_ciudades_departamento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ciudades_departamento_id ON public.ciudades USING btree (departamento_id);


--
-- Name: idx_ciudades_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ciudades_nombre ON public.ciudades USING btree (nombre);


--
-- Name: idx_departamentos_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departamentos_nombre ON public.departamentos USING btree (nombre);


--
-- Name: idx_departamentos_pais_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departamentos_pais_id ON public.departamentos USING btree (pais_id);


--
-- Name: idx_fullments_ciudad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fullments_ciudad_id ON public.fullments USING btree (ciudad_id);


--
-- Name: idx_fullments_tienda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fullments_tienda_id ON public.fullments USING btree (tienda_id);


--
-- Name: idx_notifications_guest_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_guest_unread ON public.notifications USING btree (guest_hash, read_at, created_at DESC);


--
-- Name: idx_notifications_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_order_id ON public.notifications USING btree (order_id);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, read_at, created_at DESC);


--
-- Name: idx_oferta_productos_producto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oferta_productos_producto_id ON public.oferta_productos USING btree (producto_id);


--
-- Name: idx_ofertas_ciudad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ofertas_ciudad_id ON public.ofertas USING btree (ciudad_id);


--
-- Name: idx_ofertas_tienda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ofertas_tienda_id ON public.ofertas USING btree (tienda_id);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);


--
-- Name: idx_order_items_shipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_shipment_id ON public.order_items USING btree (shipment_id);


--
-- Name: idx_order_shipments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_shipments_order_id ON public.order_shipments USING btree (order_id);


--
-- Name: idx_orders_fulfillment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_fulfillment_status ON public.orders USING btree (fulfillment_status);


--
-- Name: idx_orders_identification_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_identification_number ON public.orders USING btree (identification_number);


--
-- Name: idx_orders_merca_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_merca_payment_id ON public.orders USING btree (mercadopago_payment_id);


--
-- Name: idx_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_order_number ON public.orders USING btree (order_number);


--
-- Name: idx_orders_tienda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_tienda_id ON public.orders USING btree (tienda_id);


--
-- Name: idx_pagos_exitosos_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_exitosos_order_id ON public.pagos_exitosos USING btree (order_id);


--
-- Name: idx_paises_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_paises_nombre ON public.paises USING btree (nombre);


--
-- Name: idx_perfiles_envio_ciudad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_perfiles_envio_ciudad_id ON public.perfiles_envio USING btree (ciudad_id);


--
-- Name: idx_perfiles_envio_fullment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_perfiles_envio_fullment_id ON public.perfiles_envio USING btree (fullment_id);


--
-- Name: idx_perfiles_envio_tienda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_perfiles_envio_tienda_id ON public.perfiles_envio USING btree (tienda_id);


--
-- Name: idx_produc_categoria_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produc_categoria_id ON public.produc USING btree (categoria_id);


--
-- Name: idx_produc_external_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produc_external_id ON public.produc USING btree (external_product_id);


--
-- Name: idx_produc_fullm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produc_fullm_id ON public.produc USING btree (fullm_id);


--
-- Name: idx_produc_integracion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produc_integracion_id ON public.produc USING btree (integracion_id);


--
-- Name: idx_produc_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produc_name ON public.produc USING btree (name);


--
-- Name: idx_produc_perfil_envio_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produc_perfil_envio_id ON public.produc USING btree (perfil_envio_id);


--
-- Name: idx_produc_public_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produc_public_id ON public.produc USING btree (public_id);


--
-- Name: idx_produc_selected_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produc_selected_variant_id ON public.produc USING btree (selected_variant_id);


--
-- Name: idx_produc_tienda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produc_tienda_id ON public.produc USING btree (tienda_id);


--
-- Name: idx_produc_tipo_empaque_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produc_tipo_empaque_id ON public.produc USING btree (tipo_empaque_id);


--
-- Name: idx_reviews_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_order ON public.reviews USING btree (order_id);


--
-- Name: idx_reviews_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_product ON public.reviews USING btree (product_id);


--
-- Name: idx_reviews_shipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_shipment ON public.reviews USING btree (shipment_id);


--
-- Name: idx_reviews_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_user ON public.reviews USING btree (user_id);


--
-- Name: idx_tienda_dian_tienda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tienda_dian_tienda_id ON public.tienda_dian USING btree (tienda_id);


--
-- Name: idx_tienda_integraciones_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tienda_integraciones_provider ON public.tienda_integraciones USING btree (provider);


--
-- Name: idx_tienda_integraciones_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tienda_integraciones_user_id ON public.tienda_integraciones USING btree (user_id);


--
-- Name: idx_users_discord_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_discord_id ON public.users USING btree (discord_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_google_id ON public.users USING btree (google_id);


--
-- Name: idx_users_hashid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_hashid ON public.tiendas USING btree (hashid);


--
-- Name: uq_oferta_global_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_oferta_global_activa ON public.ofertas USING btree (tienda_id) WHERE (((alcance)::text = 'global'::text) AND ((estado)::text = 'activo'::text));


--
-- Name: uq_reviews_product_user_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_reviews_product_user_order ON public.reviews USING btree (product_id, user_id, order_id);


--
-- Name: categorias categorias_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES public.tiendas(usrid) ON DELETE CASCADE;


--
-- Name: checkout_integrations checkout_integrations_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_integrations
    ADD CONSTRAINT checkout_integrations_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES public.tiendas(usrid) ON DELETE CASCADE;


--
-- Name: ciudades ciudades_departamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ciudades
    ADD CONSTRAINT ciudades_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES public.departamentos(id) ON DELETE CASCADE;


--
-- Name: departamentos departamentos_pais_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departamentos
    ADD CONSTRAINT departamentos_pais_id_fkey FOREIGN KEY (pais_id) REFERENCES public.paises(id) ON DELETE CASCADE;


--
-- Name: favoritos favoritos_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favoritos
    ADD CONSTRAINT favoritos_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.produc(id) ON DELETE CASCADE;


--
-- Name: favoritos favoritos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favoritos
    ADD CONSTRAINT favoritos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: fullments fullments_ciudad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fullments
    ADD CONSTRAINT fullments_ciudad_id_fkey FOREIGN KEY (ciudad_id) REFERENCES public.ciudades(id) ON DELETE CASCADE;


--
-- Name: fullments fullments_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fullments
    ADD CONSTRAINT fullments_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES public.tiendas(usrid) ON DELETE CASCADE;


--
-- Name: notifications notifications_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: oferta_productos oferta_productos_oferta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oferta_productos
    ADD CONSTRAINT oferta_productos_oferta_id_fkey FOREIGN KEY (oferta_id) REFERENCES public.ofertas(id) ON DELETE CASCADE;


--
-- Name: oferta_productos oferta_productos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oferta_productos
    ADD CONSTRAINT oferta_productos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.produc(id) ON DELETE CASCADE;


--
-- Name: ofertas ofertas_ciudad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ofertas
    ADD CONSTRAINT ofertas_ciudad_id_fkey FOREIGN KEY (ciudad_id) REFERENCES public.ciudades(id) ON DELETE CASCADE;


--
-- Name: ofertas ofertas_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ofertas
    ADD CONSTRAINT ofertas_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES public.tiendas(usrid) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.produc(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.order_shipments(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_tienda_integracion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_tienda_integracion_id_fkey FOREIGN KEY (tienda_integracion_id) REFERENCES public.tienda_integraciones(id) ON DELETE SET NULL;


--
-- Name: order_shipments order_shipments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_shipments
    ADD CONSTRAINT order_shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES public.tiendas(usrid) ON DELETE SET NULL;


--
-- Name: pagos_exitosos pagos_exitosos_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_exitosos
    ADD CONSTRAINT pagos_exitosos_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: pagos_exitosos pagos_exitosos_tienda_integracion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_exitosos
    ADD CONSTRAINT pagos_exitosos_tienda_integracion_id_fkey FOREIGN KEY (tienda_integracion_id) REFERENCES public.tienda_integraciones(id) ON DELETE RESTRICT;


--
-- Name: perfiles_envio perfiles_envio_ciudad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles_envio
    ADD CONSTRAINT perfiles_envio_ciudad_id_fkey FOREIGN KEY (ciudad_id) REFERENCES public.ciudades(id) ON DELETE SET NULL;


--
-- Name: perfiles_envio perfiles_envio_fullment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles_envio
    ADD CONSTRAINT perfiles_envio_fullment_id_fkey FOREIGN KEY (fullment_id) REFERENCES public.fullments(id) ON DELETE CASCADE;


--
-- Name: perfiles_envio perfiles_envio_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles_envio
    ADD CONSTRAINT perfiles_envio_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES public.tiendas(usrid) ON DELETE CASCADE;


--
-- Name: produc produc_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produc
    ADD CONSTRAINT produc_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE SET NULL;


--
-- Name: produc produc_fullm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produc
    ADD CONSTRAINT produc_fullm_id_fkey FOREIGN KEY (fullm_id) REFERENCES public.fullments(id) ON DELETE SET NULL;


--
-- Name: produc produc_integracion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produc
    ADD CONSTRAINT produc_integracion_id_fkey FOREIGN KEY (integracion_id) REFERENCES public.tienda_integraciones(id) ON DELETE SET NULL;


--
-- Name: produc produc_perfil_envio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produc
    ADD CONSTRAINT produc_perfil_envio_id_fkey FOREIGN KEY (perfil_envio_id) REFERENCES public.perfiles_envio(id) ON DELETE SET NULL;


--
-- Name: produc produc_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produc
    ADD CONSTRAINT produc_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES public.tiendas(usrid) ON DELETE CASCADE;


--
-- Name: produc produc_tipo_empaque_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produc
    ADD CONSTRAINT produc_tipo_empaque_id_fkey FOREIGN KEY (tipo_empaque_id) REFERENCES public.tipos_empaque(id);


--
-- Name: reviews reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.produc(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.order_shipments(id) ON DELETE SET NULL;


--
-- Name: tienda_dian tienda_dian_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_dian
    ADD CONSTRAINT tienda_dian_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES public.tiendas(usrid) ON DELETE CASCADE;


--
-- Name: tienda_integraciones tienda_integraciones_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_integraciones
    ADD CONSTRAINT tienda_integraciones_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_addresses user_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_cards user_cards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cards
    ADD CONSTRAINT user_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_credentials user_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ech9wD1nIhSvgBkdGP7ACBo0k1ZfLzORIq28Bv6JfpySyz4DJUugeWESbE8EfwR

