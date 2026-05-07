<?php
/**
 * Plugin Name: Haushaltskosten Quickcheck
 * Plugin URI:  https://pro-finanz.at
 * Description: Finanz-Quickcheck Wizard mit Haushaltskosten-Analyse. Shortcode: [quickcheck] — optional mit Partner-ID: [quickcheck partner="rh"]
 * Version:     3.0.0
 * Author:      Pro-Finanz
 * Text Domain: quickcheck
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'QC_VERSION', '3.0.0' );
define( 'QC_DIR',     plugin_dir_path( __FILE__ ) );
define( 'QC_URL',     plugin_dir_url( __FILE__ ) );

/* ═══════════ Module laden ═══════════ */
require_once QC_DIR . 'includes/class-qc-partners.php';

if ( is_admin() ) {
    require_once QC_DIR . 'admin/class-qc-admin.php';
    new QC_Admin();
}

/* ═══════════ Partner-Daten (dynamisch aus DB) ═══════════ */
function qc_get_partners() {
    return QC_Partners::get_all();
}

/* ═══════════ Quickcheck-Seiten-URL ermitteln ═══════════ */
function qc_get_page_url() {
    $saved = get_option( 'qc_page_url', '' );
    if ( ! empty( $saved ) ) {
        return $saved;
    }

    global $wpdb;

    $page = $wpdb->get_row(
        "SELECT ID FROM {$wpdb->posts}
         WHERE post_status = 'publish'
         AND ( post_type = 'page' OR post_type = 'post' )
         AND post_content LIKE '%[quickcheck%'
         ORDER BY post_type ASC, ID ASC
         LIMIT 1"
    );

    if ( ! $page ) {
        $page = $wpdb->get_row(
            "SELECT p.ID FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
             WHERE p.post_status = 'publish'
             AND ( p.post_type = 'page' OR p.post_type = 'post' )
             AND pm.meta_value LIKE '%[quickcheck%'
             ORDER BY p.post_type ASC, p.ID ASC
             LIMIT 1"
        );
    }

    if ( $page ) {
        $url = get_permalink( $page->ID );
        update_option( 'qc_page_url', $url );
        return $url;
    }

    return home_url( '/' );
}

/* Cache invalidieren wenn Seiten bearbeitet werden */
add_action( 'save_post', function( $post_id ) {
    $post = get_post( $post_id );
    if ( ! $post ) return;

    $found = false;
    if ( strpos( $post->post_content, '[quickcheck' ) !== false ) {
        $found = true;
    }
    if ( ! $found ) {
        global $wpdb;
        $found = (bool) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->postmeta}
             WHERE post_id = %d AND meta_value LIKE '%%[quickcheck%%'",
            $post_id
        ) );
    }
    if ( $found ) {
        update_option( 'qc_page_url', get_permalink( $post_id ) );
    }
}, 10, 1 );

/* ═══════════ SHORTCODE ═══════════ */
function qc_shortcode( $atts ) {
    $atts = shortcode_atts( array( 'partner' => '' ), $atts, 'quickcheck' );

    qc_enqueue_assets();

    $partner_id = sanitize_text_field( $atts['partner'] );
    if ( empty( $partner_id ) && isset( $_GET['partner'] ) ) {
        $partner_id = sanitize_text_field( $_GET['partner'] );
    }

    return sprintf(
        '<div id="quickcheck-root" data-partner="%s"></div>',
        esc_attr( $partner_id )
    );
}
add_shortcode( 'quickcheck', 'qc_shortcode' );

/* ═══════════ ASSETS ═══════════ */
function qc_enqueue_assets() {

    wp_enqueue_style( 'qc-outfit-font',
        'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
        array(), null );

    wp_enqueue_style( 'qc-styles',
        QC_URL . 'css/quickcheck.css', array(), QC_VERSION );

    wp_enqueue_script( 'qc-react',
        'https://unpkg.com/react@18.2.0/umd/react.production.min.js',
        array(), '18.2.0', true );
    wp_enqueue_script( 'qc-react-dom',
        'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js',
        array( 'qc-react' ), '18.2.0', true );

    wp_enqueue_script( 'qc-prop-types',
        'https://unpkg.com/prop-types@15.8.1/prop-types.min.js',
        array( 'qc-react' ), '15.8.1', true );

    wp_enqueue_script( 'qc-recharts',
        'https://unpkg.com/recharts@2.12.7/umd/Recharts.js',
        array( 'qc-react', 'qc-react-dom', 'qc-prop-types' ), '2.12.7', true );

    wp_enqueue_script( 'qc-app',
        QC_URL . 'js/quickcheck-app.js',
        array( 'qc-react', 'qc-react-dom', 'qc-prop-types', 'qc-recharts' ),
        QC_VERSION, true );

    wp_localize_script( 'qc-app', 'qcAjax', array(
        'url'      => admin_url( 'admin-ajax.php' ),
        'nonce'    => wp_create_nonce( 'qc_submit_nonce' ),
        'partners' => qc_get_partners(),
    ));
}

/* ═══════════ AJAX HANDLER ═══════════ */
add_action( 'wp_ajax_qc_submit',        'qc_handle_submit' );
add_action( 'wp_ajax_nopriv_qc_submit', 'qc_handle_submit' );

function qc_handle_submit() {

    if ( ! wp_verify_nonce( $_POST['nonce'] ?? '', 'qc_submit_nonce' ) ) {
        wp_send_json_error( 'Ungültige Anfrage.', 403 );
    }

    $raw     = stripslashes( $_POST['payload'] ?? '{}' );
    $payload = json_decode( $raw, true );

    if ( ! $payload ) {
        wp_send_json_error( 'Ungültige Daten.', 400 );
    }

    $partners    = qc_get_partners();
    $partner_key = sanitize_text_field( $payload['partnerId'] ?? '' );
    $partner     = $partners[ $partner_key ] ?? null;

    $kunde_name    = sanitize_text_field( $payload['kontakt']['name'] ?? '' );
    $kunde_email   = sanitize_email( $payload['kontakt']['email'] ?? '' );

    $to      = $partner ? $partner['email'] : get_option( 'admin_email' );
    $body    = qc_build_email_body( $payload, $partner );

    /*
     * Content-Type per Filter statt per Header setzen.
     * Manueller Header erzeugt Duplikate wenn FluentSMTP / PHPMailer
     * den Content-Type eigenständig setzt → securemail.pro 422.
     */
    $qc_set_html = function() { return 'text/html'; };
    add_filter( 'wp_mail_content_type', $qc_set_html );

    $headers = array();
    if ( $kunde_email ) {
        /*
         * Reply-To: nur E-Mail-Adresse, KEIN RFC 2047-kodierter Name.
         * FluentSMTP / PHPMailer kodiert Header selbst – manuelle
         * Base64-Kodierung führt zu Doppelkodierung und wird von
         * securemail.pro mit 422 "data not accepted" abgelehnt.
         */
        $headers[] = 'Reply-To: ' . $kunde_email;
    }

    /*
     * Subject: nur ASCII-sichere Zeichen.
     * PHPMailer kodiert den Betreff selbst (RFC 2047) – wenn FluentSMTP
     * nochmals kodiert, entsteht wieder Doppelkodierung.
     * Wir entfernen manuell alle Nicht-ASCII-Zeichen und ersetzen sie
     * durch sichere Transliterationen (ä→ae usw.).
     */
    $safe_name = qc_transliterate( $kunde_name ?: 'Unbekannt' );
    $subject   = 'Neuer Quickcheck von ' . $safe_name;

    /* Debug: log mail errors + headers (nach Stabilisierung entfernen) */
    $mail_error = '';
    add_action( 'wp_mail_failed', function( $wp_error ) use ( &$mail_error ) {
        $mail_error = $wp_error->get_error_message();
    });

    error_log( 'QC Mail → To: ' . $to . ' | Subject: ' . $subject . ' | Headers: ' . wp_json_encode( $headers ) . ' | Body: ' . strlen( $body ) . ' Bytes' );

    $sent = wp_mail( $to, $subject, $body, $headers );

    /* Filter sofort entfernen um andere Mails nicht zu beeinflussen */
    remove_filter( 'wp_mail_content_type', $qc_set_html );

    if ( ! $sent && $mail_error ) {
        error_log( 'QC Mail Error: ' . $mail_error );
    }

    /* Admin-Kopie nur senden wenn in Einstellungen aktiviert */
    if ( get_option( 'qc_send_admin_copy', false ) ) {
        $admin_email = get_option( 'admin_email' );
        if ( $to !== $admin_email ) {
            /* Kopie ohne Reply-To (Admin soll nicht an Kunden antworten) */
            add_filter( 'wp_mail_content_type', $qc_set_html );
            wp_mail( $admin_email, '[Kopie] ' . $subject, $body );
            remove_filter( 'wp_mail_content_type', $qc_set_html );
        }
    }

    if ( $sent ) {
        wp_send_json_success( 'E-Mail erfolgreich gesendet.' );
    } else {
        $msg = 'E-Mail konnte nicht gesendet werden.';
        if ( $mail_error && current_user_can( 'manage_options' ) ) {
            $msg .= ' Fehler: ' . $mail_error . ' (Body: ' . strlen( $body ) . ' Bytes)';
        }
        wp_send_json_error( $msg, 500 );
    }
}

/* ── Helper: Deutsche Sonderzeichen → ASCII (für Header) ── */
function qc_transliterate( $str ) {
    $map = array(
        'ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss',
        'Ä' => 'Ae', 'Ö' => 'Oe', 'Ü' => 'Ue',
        'é' => 'e',  'è' => 'e',  'ê' => 'e',  'á' => 'a',
        'à' => 'a',  'â' => 'a',  'ó' => 'o',  'ò' => 'o',
        'ô' => 'o',  'ú' => 'u',  'ù' => 'u',  'û' => 'u',
        'í' => 'i',  'ì' => 'i',  'î' => 'i',  'ñ' => 'n',
        'ç' => 'c',  'ć' => 'c',  'č' => 'c',  'ž' => 'z',
        'š' => 's',  'đ' => 'd',
    );
    $str = strtr( $str, $map );
    // Verbleibende Nicht-ASCII-Zeichen entfernen
    return preg_replace( '/[^\x20-\x7E]/', '', $str );
}

/* ── Helper: Person-Tabelle für E-Mail ── */
function qc_render_person_table( $person, $title ) {
    if ( empty( $person ) || empty( $person['name'] ) ) return '';

    $fields = array(
        'name' => 'Name', 'gebDatum' => 'Geb.Datum', 'gebOrt' => 'Geb.Ort',
        'gebLand' => 'Geb.Land', 'familienstand' => 'Familienstand',
        'staatsangehoerigkeit' => 'Staatsangehörigkeit', 'email' => 'E-Mail',
        'telefon' => 'Telefon', 'strasse' => 'Straße & Nr.', 'plz' => 'PLZ',
        'ort' => 'Ort', 'beruf' => 'Beruf', 'branche' => 'Branche',
        'iban' => 'IBAN', 'raucher' => 'Raucher', 'groesse' => 'Größe (cm)',
        'gewicht' => 'Gewicht (kg)',
    );

    $html = '<h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">' . esc_html( $title ) . '</h2>';
    $html .= '<table style="width:100%;font-size:14px;margin-bottom:20px;" cellpadding="4">';
    foreach ( $fields as $key => $label ) {
        $val = esc_html( $person[ $key ] ?? '—' );
        if ( empty( trim( $person[ $key ] ?? '' ) ) ) $val = '—';
        $html .= '<tr><td style="color:#999;width:160px;">' . esc_html( $label ) . '</td><td><strong>' . $val . '</strong></td></tr>';
    }
    $html .= '</table>';
    return $html;
}

/* ── Helper: Kategorie-Felder-Map (für Aufschlüsselung Haushaltskosten) ── */
function qc_get_kosten_felder_map() {
    return array(
        'Wohnkosten' => array(
            'miete' => 'Miete / Hypothek',
            'instandhaltung' => 'Instandhaltung',
            'strom' => 'Strom',
            'gas' => 'Gas',
            'wasser' => 'Wasser',
        ),
        'Konsum / Fixkosten' => array(
            'lebensmittel' => 'Lebensmittel',
            'kleidung' => 'Kleidung',
            'kommunikation' => 'Kommunikation (Internet, Handy)',
            'abos' => 'Abos',
            'leasing' => 'Leasing / Kredit',
            'kfz' => 'KFZ',
            'haustiere' => 'Haustiere',
            'zigaretten' => 'Zigaretten',
            'geschenke' => 'Geschenke',
            'kinderbetreuung' => 'Kinder / Betreuung',
            'freizeit' => 'Freizeit / Hobbys',
            'urlaub' => 'Urlaub',
            'restaurant' => 'Restaurantbesuche',
        ),
    );
}

/* ── Helper: Versicherungs-Sparten Labels ── */
function qc_get_vers_labels() {
    return array(
        'eigenheim' => 'Eigenheim',
        'haushalt' => 'Haushalt',
        'haftpflicht' => 'Haftpflicht',
        'rechtsschutz' => 'Rechtsschutz',
        'unfall' => 'Unfall',
        'kranken' => 'Kranken',
        'berufsunfaehigkeit' => 'BU',
        'kfzvers' => 'KFZ',
        'ableben' => 'Ableben',
        'sonstige' => 'Sonstige',
    );
}

/* ── Helper: Versicherungen einer Person aufschlüsseln (alle Einträge je Sparte) ── */
function qc_render_versicherungen_table( $vers_data, $titel ) {
    if ( empty( $vers_data ) || ! is_array( $vers_data ) ) return '';

    $vers_labels = qc_get_vers_labels();
    $rows        = '';
    $summe       = 0;

    foreach ( $vers_labels as $key => $label ) {
        $eintraege = $vers_data[ $key ] ?? array();
        if ( ! is_array( $eintraege ) ) continue;

        foreach ( $eintraege as $v ) {
            if ( ! is_array( $v ) ) continue;
            $betrag       = floatval( $v['betrag'] ?? 0 );
            $gesellschaft = trim( $v['gesellschaft'] ?? '' );
            if ( $betrag <= 0 && $gesellschaft === '' ) continue;

            $info = '';
            if ( ! empty( $v['qm'] ) )      $info = $v['qm'] . ' m²';
            if ( ! empty( $v['bmstufe'] ) ) $info = 'BM ' . $v['bmstufe'];

            $summe += $betrag;
            $rows  .= '<tr style="border-bottom:1px solid #f0f0f0;">'
                    . '<td>' . esc_html( $label ) . '</td>'
                    . '<td style="text-align:right;">€ ' . number_format( $betrag, 2, ',', '.' ) . '</td>'
                    . '<td>' . esc_html( $gesellschaft !== '' ? $gesellschaft : '—' ) . '</td>'
                    . '<td>' . esc_html( $info !== '' ? $info : '—' ) . '</td>'
                    . '</tr>';
        }
    }

    if ( $rows === '' ) return '';

    $html  = '<h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">' . esc_html( $titel ) . '</h2>';
    $html .= '<table style="width:100%;font-size:14px;margin-bottom:20px;border-collapse:collapse;" cellpadding="4">';
    $html .= '<tr style="background:#fdf8e8;"><th style="text-align:left;">Sparte</th><th style="text-align:right;">Prämie (mtl.)</th><th style="text-align:left;">Gesellschaft</th><th style="text-align:left;">Info</th></tr>';
    $html .= $rows;
    $html .= '<tr style="background:#fafafa;font-weight:600;"><td>Summe ' . esc_html( $titel ) . '</td><td style="text-align:right;">€ ' . number_format( $summe, 2, ',', '.' ) . '</td><td colspan="2"></td></tr>';
    $html .= '</table>';
    return $html;
}

/* ── Helper: Sparen einer Person aufschlüsseln (alle Einträge je Typ) ── */
function qc_render_sparen_table( $sparen_data, $titel ) {
    if ( empty( $sparen_data ) || ! is_array( $sparen_data ) ) return '';

    $rows  = '';
    $summe_monatlich = 0;
    $summe_bestand   = 0;

    /* Girokonten */
    foreach ( (array) ( $sparen_data['girokonten'] ?? array() ) as $g ) {
        if ( ! is_array( $g ) ) continue;
        $kontostand = floatval( $g['kontostand'] ?? 0 );
        $bank       = trim( $g['bank'] ?? '' );
        if ( $kontostand <= 0 && $bank === '' ) continue;
        $summe_bestand += $kontostand;
        $rows .= '<tr style="border-bottom:1px solid #f0f0f0;">'
               . '<td style="color:#999;">Girokonto</td>'
               . '<td>' . esc_html( $bank !== '' ? $bank : '—' ) . '</td>'
               . '<td style="text-align:right;">—</td>'
               . '<td style="text-align:right;">€ ' . number_format( $kontostand, 2, ',', '.' ) . '</td>'
               . '</tr>';
    }

    /* Sparkonten */
    foreach ( (array) ( $sparen_data['sparkonten'] ?? array() ) as $s ) {
        if ( ! is_array( $s ) ) continue;
        $monatlich  = floatval( $s['monatlich']  ?? 0 );
        $kontostand = floatval( $s['kontostand'] ?? 0 );
        if ( $monatlich <= 0 && $kontostand <= 0 ) continue;
        $summe_monatlich += $monatlich;
        $summe_bestand   += $kontostand;
        $rows .= '<tr style="border-bottom:1px solid #f0f0f0;">'
               . '<td style="color:#999;">Sparkonto</td>'
               . '<td>—</td>'
               . '<td style="text-align:right;">€ ' . number_format( $monatlich,  2, ',', '.' ) . '</td>'
               . '<td style="text-align:right;">€ ' . number_format( $kontostand, 2, ',', '.' ) . '</td>'
               . '</tr>';
    }

    /* Bausparer */
    foreach ( (array) ( $sparen_data['bausparer'] ?? array() ) as $b ) {
        if ( ! is_array( $b ) ) continue;
        $monatlich  = floatval( $b['monatlich']  ?? 0 );
        $kontostand = floatval( $b['kontostand'] ?? 0 );
        if ( $monatlich <= 0 && $kontostand <= 0 ) continue;
        $summe_monatlich += $monatlich;
        $summe_bestand   += $kontostand;
        $rows .= '<tr style="border-bottom:1px solid #f0f0f0;">'
               . '<td style="color:#999;">Bausparer</td>'
               . '<td>—</td>'
               . '<td style="text-align:right;">€ ' . number_format( $monatlich,  2, ',', '.' ) . '</td>'
               . '<td style="text-align:right;">€ ' . number_format( $kontostand, 2, ',', '.' ) . '</td>'
               . '</tr>';
    }

    /* Fonds / ETF */
    foreach ( (array) ( $sparen_data['fonds'] ?? array() ) as $f ) {
        if ( ! is_array( $f ) ) continue;
        $monatlich  = floatval( $f['monatlich']  ?? 0 );
        $kontostand = floatval( $f['kontostand'] ?? 0 );
        $name       = trim( $f['name'] ?? '' );
        $isin       = trim( $f['isin'] ?? '' );
        if ( $monatlich <= 0 && $kontostand <= 0 && $name === '' && $isin === '' ) continue;
        $summe_monatlich += $monatlich;
        $summe_bestand   += $kontostand;
        $bezeichnung = ( $name !== '' ? $name : '—' ) . ( $isin !== '' ? ' (' . $isin . ')' : '' );
        $rows .= '<tr style="border-bottom:1px solid #f0f0f0;">'
               . '<td style="color:#999;">Fonds / ETF</td>'
               . '<td>' . esc_html( $bezeichnung ) . '</td>'
               . '<td style="text-align:right;">€ ' . number_format( $monatlich,  2, ',', '.' ) . '</td>'
               . '<td style="text-align:right;">€ ' . number_format( $kontostand, 2, ',', '.' ) . '</td>'
               . '</tr>';
    }

    /* Lebensversicherungen */
    foreach ( (array) ( $sparen_data['lebensversicherungen'] ?? array() ) as $lv ) {
        if ( ! is_array( $lv ) ) continue;
        $monatlich    = floatval( $lv['monatlich'] ?? 0 );
        $gesellschaft = trim( $lv['gesellschaft'] ?? '' );
        if ( $monatlich <= 0 && $gesellschaft === '' ) continue;
        $summe_monatlich += $monatlich;
        $rows .= '<tr style="border-bottom:1px solid #f0f0f0;">'
               . '<td style="color:#999;">Lebensversicherung</td>'
               . '<td>' . esc_html( $gesellschaft !== '' ? $gesellschaft : '—' ) . '</td>'
               . '<td style="text-align:right;">€ ' . number_format( $monatlich, 2, ',', '.' ) . '</td>'
               . '<td style="text-align:right;">—</td>'
               . '</tr>';
    }

    /* Gold */
    foreach ( (array) ( $sparen_data['gold'] ?? array() ) as $g ) {
        if ( ! is_array( $g ) ) continue;
        $monatlich  = floatval( $g['monatlich']  ?? 0 );
        $kontostand = floatval( $g['kontostand'] ?? 0 );
        if ( $monatlich <= 0 && $kontostand <= 0 ) continue;
        $summe_monatlich += $monatlich;
        $summe_bestand   += $kontostand;
        $rows .= '<tr style="border-bottom:1px solid #f0f0f0;">'
               . '<td style="color:#999;">Gold</td>'
               . '<td>—</td>'
               . '<td style="text-align:right;">€ ' . number_format( $monatlich,  2, ',', '.' ) . '</td>'
               . '<td style="text-align:right;">€ ' . number_format( $kontostand, 2, ',', '.' ) . '</td>'
               . '</tr>';
    }

    if ( $rows === '' ) return '';

    $html  = '<h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">' . esc_html( $titel ) . '</h2>';
    $html .= '<table style="width:100%;font-size:14px;margin-bottom:20px;border-collapse:collapse;" cellpadding="4">';
    $html .= '<tr style="background:#fdf8e8;"><th style="text-align:left;">Typ</th><th style="text-align:left;">Bezeichnung / Bank</th><th style="text-align:right;">Mtl. Sparrate</th><th style="text-align:right;">Kontostand</th></tr>';
    $html .= $rows;
    $html .= '<tr style="background:#fafafa;font-weight:600;"><td colspan="2">Summe ' . esc_html( $titel ) . '</td><td style="text-align:right;">€ ' . number_format( $summe_monatlich, 2, ',', '.' ) . '</td><td style="text-align:right;">€ ' . number_format( $summe_bestand, 2, ',', '.' ) . '</td></tr>';
    $html .= '</table>';
    return $html;
}

/* ── HTML E-Mail ── */
function qc_build_email_body( $payload, $partner ) {
    $kontakt         = $payload['kontakt'] ?? array();
    $einstieg        = $payload['einstiegsfragen'] ?? array();
    $personA         = $payload['personA'] ?? array();
    $personB         = $payload['personB'] ?? null;
    $kinder          = $payload['kinder'] ?? array();
    $quickcheck      = $payload['quickcheck'] ?? array();
    $kategorien      = $payload['kategorien'] ?? array();
    $kosten          = $payload['kosten'] ?? array();
    $versicherungen  = $payload['versicherungen'] ?? array();
    $versicherungenB = $payload['versicherungenB'] ?? null;
    $sparen_data     = $payload['sparen'] ?? array();
    $sparen_dataB    = $payload['sparenB'] ?? null;
    $gesellschaften  = $payload['gesellschaften'] ?? array();
    $einkommen_total = floatval( $payload['einkommen']  ?? 0 );
    $einkommenA      = floatval( $payload['einkommenA'] ?? 0 );
    $einkommenB      = isset( $payload['einkommenB'] ) ? floatval( $payload['einkommenB'] ) : null;
    $einkommen_fmt   = number_format( $einkommen_total, 0, ',', '.' );
    $vollmacht       = ! empty( $payload['vollmacht'] ) ? 'Ja' : 'Nein';
    $signatur        = ( $payload['signatur'] ?? 'keine' ) === 'vorhanden' ? 'Vorhanden' : 'Keine';
    $anz_personen    = intval( $payload['kontaktPersonen'] ?? 1 );

    $felder_map = qc_get_kosten_felder_map();

    ob_start();
    ?>
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="UTF-8"></head>
    <body style="font-family:'Outfit',Arial,sans-serif;color:#1a1b25;background:#f9f9f9;padding:20px;">
    <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #e5e5e5;">
        <div style="background:linear-gradient(90deg,#c6a559,#f5d86b);padding:24px 30px;">
            <h1 style="margin:0;font-size:22px;color:#1a1b25;">Quickcheck-Ergebnis</h1>
            <p style="margin:6px 0 0;font-size:14px;color:#5a5030;">
                <?php echo esc_html( $kontakt['name'] ?? 'Unbekannt' ); ?>
                <?php if ( $anz_personen > 1 && !empty( $personB['name'] ) ) : ?> & <?php echo esc_html( $personB['name'] ); ?><?php endif; ?>
                <?php if ( $partner ) : ?> · Berater: <?php echo esc_html( $partner['name'] ); ?><?php endif; ?>
            </p>
        </div>
        <div style="padding:24px 30px;">

            <!-- Einstiegsfragen -->
            <?php if ( ! empty( $einstieg['grund'] ) || ! empty( $einstieg['erwartung'] ) || ! empty( $einstieg['orientierung'] ) ) : ?>
            <h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">Einstiegsfragen</h2>
            <table style="width:100%;font-size:14px;margin-bottom:20px;" cellpadding="4">
                <tr><td style="color:#999;width:220px;">Grund für heute</td><td><?php echo esc_html( $einstieg['grund'] ?? '—' ); ?></td></tr>
                <tr><td style="color:#999;">Erwartung</td><td><?php echo esc_html( $einstieg['erwartung'] ?? '—' ); ?></td></tr>
                <tr><td style="color:#999;">Orientierung oder Entscheidung</td><td><?php echo esc_html( $einstieg['orientierung'] ?? '—' ); ?></td></tr>
            </table>
            <?php endif; ?>

            <!-- Kontaktdaten -->
            <?php echo qc_render_person_table( $personA, $anz_personen > 1 ? 'Person A' : 'Kontaktdaten' ); ?>
            <?php if ( $anz_personen > 1 && $personB ) echo qc_render_person_table( $personB, 'Person B' ); ?>

            <!-- Kinder -->
            <?php if ( ! empty( $kinder ) ) : ?>
            <h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">Kinder (<?php echo count( $kinder ); ?>)</h2>
            <table style="width:100%;font-size:14px;margin-bottom:20px;border-collapse:collapse;" cellpadding="4">
                <tr style="background:#fdf8e8;"><th style="text-align:left;">Name</th><th>Geb.Datum</th><th>Geb.Ort</th><th>Größe</th><th>Gewicht</th></tr>
                <?php foreach ( $kinder as $kind ) : ?>
                <tr style="border-bottom:1px solid #f0f0f0;">
                    <td><?php echo esc_html( $kind['name'] ?? '—' ); ?></td>
                    <td><?php echo esc_html( $kind['gebDatum'] ?? '—' ); ?></td>
                    <td><?php echo esc_html( $kind['gebOrt'] ?? '—' ); ?></td>
                    <td><?php echo esc_html( $kind['groesse'] ?? '—' ); ?> cm</td>
                    <td><?php echo esc_html( $kind['gewicht'] ?? '—' ); ?> kg</td>
                </tr>
                <?php endforeach; ?>
            </table>
            <?php endif; ?>

            <!-- Quickcheck-Antworten -->
            <h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">Quickcheck-Antworten</h2>
            <table style="width:100%;font-size:14px;margin-bottom:20px;" cellpadding="4">
            <?php
            $labels = array(
                'themen' => 'Aktuelle Themen',
                'themenSonstig' => 'Sonstiges (Themen)', 'prioritaeten' => 'Prioritäten',
                'wohnen' => 'Wohnen & Immobilie', 'familie' => 'Familie & Zukunft',
                'pensionGefuehl' => 'Pension – Gefühl',
                'pensionHoehe' => 'Gewünschte Pensionshöhe (€)',
                'pensionAlter' => 'Gewünschtes Pensionsalter',
                'zukunftWunsch' => 'Zukunftswunsch',
                'absicherung' => 'Absicherung', 'investmentRisiko' => 'Investment – Risiko',
                'investmentZeit' => 'Investment – Zeithorizont', 'erfahrung' => 'Erfahrung',
                'beratungWichtig' => 'Beratung – Wichtig', 'wichtigsteFrage' => 'Wichtigste Frage',
                'abschlussfrage' => 'Abschlussfrage',
            );
            foreach ( $labels as $key => $label ) :
                $val = $quickcheck[ $key ] ?? '';
                if ( is_array( $val ) ) $val = implode( ', ', $val );
                if ( empty( $val ) ) $val = '—';
            ?>
                <tr style="border-bottom:1px solid #f0f0f0;">
                    <td style="color:#999;width:200px;vertical-align:top;"><?php echo esc_html( $label ); ?></td>
                    <td><?php echo esc_html( $val ); ?></td>
                </tr>
            <?php endforeach; ?>
            </table>

            <!-- Einkommen aufgeschlüsselt -->
            <h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">Monatl. Netto-Einkommen</h2>
            <table style="width:100%;font-size:14px;margin-bottom:20px;border-collapse:collapse;" cellpadding="6">
                <tr style="border-bottom:1px solid #f0f0f0;">
                    <td style="color:#999;width:60%;">
                        <?php echo $anz_personen > 1 ? 'Person A' : 'Einkommen'; ?>
                        <?php if ( $anz_personen > 1 && ! empty( $personA['name'] ) ) : ?> (<?php echo esc_html( $personA['name'] ); ?>)<?php endif; ?>
                    </td>
                    <td style="text-align:right;">€ <?php echo number_format( $einkommenA, 2, ',', '.' ); ?></td>
                </tr>
                <?php if ( $anz_personen > 1 && $einkommenB !== null ) : ?>
                <tr style="border-bottom:1px solid #f0f0f0;">
                    <td style="color:#999;">Person B<?php if ( ! empty( $personB['name'] ) ) : ?> (<?php echo esc_html( $personB['name'] ); ?>)<?php endif; ?></td>
                    <td style="text-align:right;">€ <?php echo number_format( $einkommenB, 2, ',', '.' ); ?></td>
                </tr>
                <?php endif; ?>
                <tr style="background:#fafafa;font-weight:600;">
                    <td>Gesamt-Einkommen</td>
                    <td style="text-align:right;">€ <?php echo $einkommen_fmt; ?></td>
                </tr>
            </table>

            <!-- Haushaltskosten – Übersicht (Kategorie-Summen) -->
            <h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">Haushaltskosten – Übersicht</h2>
            <table style="width:100%;font-size:14px;margin-bottom:20px;border-collapse:collapse;" cellpadding="6">
                <tr style="background:#fdf8e8;"><th style="text-align:left;">Kategorie</th><th style="text-align:right;">Betrag</th><th style="text-align:right;">Anteil</th><th style="text-align:right;">Optimal</th></tr>
                <?php foreach ( $kategorien as $kat ) : ?>
                <tr style="border-bottom:1px solid #f0f0f0;">
                    <td><?php echo esc_html( $kat['name'] ); ?></td>
                    <td style="text-align:right;">€ <?php echo number_format( floatval( $kat['betrag'] ), 2, ',', '.' ); ?></td>
                    <td style="text-align:right;"><?php echo intval( $kat['prozent'] ); ?>%</td>
                    <td style="text-align:right;"><?php echo intval( $kat['optimal'] ); ?>%</td>
                </tr>
                <?php endforeach; ?>
            </table>

            <!-- Haushaltskosten – Aufschlüsselung pro Position -->
            <?php foreach ( $felder_map as $kat_label => $felder ) :
                /* Prüfen ob mind. eine Position ausgefüllt ist */
                $hat_eintraege = false;
                foreach ( $felder as $fid => $flabel ) {
                    if ( floatval( $kosten[ $fid ] ?? 0 ) > 0 ) { $hat_eintraege = true; break; }
                }
                if ( ! $hat_eintraege ) continue;
                $kat_summe = 0;
            ?>
                <h3 style="font-size:14px;color:#5a5030;margin:18px 0 6px;"><?php echo esc_html( $kat_label ); ?> – Einzelpositionen</h3>
                <table style="width:100%;font-size:13px;margin-bottom:18px;border-collapse:collapse;" cellpadding="4">
                    <tr style="background:#fdf8e8;"><th style="text-align:left;">Position</th><th style="text-align:right;">Betrag (mtl.)</th></tr>
                    <?php foreach ( $felder as $fid => $flabel ) :
                        $betrag = floatval( $kosten[ $fid ] ?? 0 );
                        if ( $betrag <= 0 ) continue;
                        $kat_summe += $betrag;
                    ?>
                    <tr style="border-bottom:1px solid #f0f0f0;">
                        <td><?php echo esc_html( $flabel ); ?></td>
                        <td style="text-align:right;">€ <?php echo number_format( $betrag, 2, ',', '.' ); ?></td>
                    </tr>
                    <?php endforeach; ?>
                    <tr style="background:#fafafa;font-weight:600;">
                        <td>Summe <?php echo esc_html( $kat_label ); ?></td>
                        <td style="text-align:right;">€ <?php echo number_format( $kat_summe, 2, ',', '.' ); ?></td>
                    </tr>
                </table>
            <?php endforeach; ?>

            <!-- Versicherungen Detail (aufgeschlüsselt, alle Einträge je Sparte) -->
            <?php
            echo qc_render_versicherungen_table(
                $versicherungen,
                ( $anz_personen > 1 && ! empty( $personA['name'] ) )
                    ? 'Versicherungen – Person A (' . $personA['name'] . ')'
                    : 'Versicherungen – Detail'
            );
            if ( $anz_personen > 1 && $versicherungenB ) {
                $titelB = ! empty( $personB['name'] )
                    ? 'Versicherungen – Person B (' . $personB['name'] . ')'
                    : 'Versicherungen – Person B';
                echo qc_render_versicherungen_table( $versicherungenB, $titelB );
            }
            ?>

            <!-- Sparen Detail (aufgeschlüsselt, alle Einträge je Typ) -->
            <?php
            echo qc_render_sparen_table(
                $sparen_data,
                ( $anz_personen > 1 && ! empty( $personA['name'] ) )
                    ? 'Sparen / Investment – Person A (' . $personA['name'] . ')'
                    : 'Sparen / Investment – Detail'
            );
            if ( $anz_personen > 1 && $sparen_dataB ) {
                $titelSB = ! empty( $personB['name'] )
                    ? 'Sparen / Investment – Person B (' . $personB['name'] . ')'
                    : 'Sparen / Investment – Person B';
                echo qc_render_sparen_table( $sparen_dataB, $titelSB );
            }
            ?>

            <!-- Vollmacht -->
            <h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">Vollmacht</h2>
            <table style="width:100%;font-size:14px;" cellpadding="4">
                <tr><td style="color:#999;width:180px;">Sammelvollmacht erteilt</td><td><strong><?php echo $vollmacht; ?></strong></td></tr>
                <tr><td style="color:#999;">Unterschrift</td><td><?php echo $signatur; ?></td></tr>
                <?php if ( ! empty( $gesellschaften ) ) : ?>
                <tr><td style="color:#999;">Gesellschaften</td><td><?php echo esc_html( implode( ', ', $gesellschaften ) ); ?></td></tr>
                <?php endif; ?>
            </table>
        </div>
        <div style="background:#fafafa;padding:16px 30px;font-size:12px;color:#999;border-top:1px solid #eee;">
            Gesendet am <?php echo date_i18n( 'd.m.Y \u\m H:i', current_time( 'timestamp' ) ); ?> Uhr · pro-finanz.at Quickcheck v3
        </div>
    </div>
    </body>
    </html>
    <?php
    return ob_get_clean();
}

/* ── Admin Notice ── */
add_action( 'admin_notices', function() {
    if ( get_transient( 'qc_activation_notice' ) ) {
        echo '<div class="notice notice-success is-dismissible">';
        echo '<p><strong>Quickcheck Plugin aktiv!</strong> Shortcode: <code>[quickcheck]</code> oder <code>[quickcheck partner="rh"]</code></p>';
        echo '<p>Partner verwalten: <a href="' . admin_url( 'admin.php?page=quickcheck' ) . '">Quickcheck → Partner</a></p>';
        echo '</div>';
        delete_transient( 'qc_activation_notice' );
    }
});

register_activation_hook( __FILE__, function() {
    set_transient( 'qc_activation_notice', true, 60 );
    QC_Partners::get_all();
});
