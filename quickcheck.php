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
    $subject = sprintf( 'Neuer Quickcheck von %s', $kunde_name ?: 'Unbekannt' );
    $body    = qc_build_email_body( $payload, $partner );

    $headers = array( 'Content-Type: text/html; charset=UTF-8' );
    if ( $kunde_email ) {
        $headers[] = 'Reply-To: ' . $kunde_name . ' <' . $kunde_email . '>';
    }

    $sent = wp_mail( $to, $subject, $body, $headers );

    $admin_email = get_option( 'admin_email' );
    if ( $to !== $admin_email ) {
        wp_mail( $admin_email, '[Kopie] ' . $subject, $body, $headers );
    }

    if ( $sent ) {
        wp_send_json_success( 'E-Mail erfolgreich gesendet.' );
    } else {
        wp_send_json_error( 'E-Mail konnte nicht gesendet werden.', 500 );
    }
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

/* ── HTML E-Mail ── */
function qc_build_email_body( $payload, $partner ) {
    $kontakt        = $payload['kontakt'] ?? array();
    $einstieg       = $payload['einstiegsfragen'] ?? array();
    $personA        = $payload['personA'] ?? array();
    $personB        = $payload['personB'] ?? null;
    $kinder         = $payload['kinder'] ?? array();
    $quickcheck     = $payload['quickcheck'] ?? array();
    $kategorien     = $payload['kategorien'] ?? array();
    $versicherungen = $payload['versicherungen'] ?? array();
    $sparen_data    = $payload['sparen'] ?? array();
    $gesellschaften = $payload['gesellschaften'] ?? array();
    $einkommen      = number_format( floatval( $payload['einkommen'] ?? 0 ), 0, ',', '.' );
    $vollmacht      = ! empty( $payload['vollmacht'] ) ? 'Ja' : 'Nein';
    $signatur       = ( $payload['signatur'] ?? 'keine' ) === 'vorhanden' ? '✔ Vorhanden' : '✗ Keine';
    $anz_personen   = intval( $payload['kontaktPersonen'] ?? 1 );

    ob_start();
    ?>
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="UTF-8"></head>
    <body style="font-family:'Outfit',Arial,sans-serif;color:#1a1b25;background:#f9f9f9;padding:20px;">
    <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #e5e5e5;">
        <div style="background:linear-gradient(90deg,#c6a559,#f5d86b);padding:24px 30px;">
            <h1 style="margin:0;font-size:22px;color:#1a1b25;">📊 Quickcheck-Ergebnis</h1>
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
                'beratungWichtig' => 'Beratung – Wichtig', 'wichtigsteFrage' => '⭐ Wichtigste Frage',
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

            <!-- Haushaltskosten -->
            <h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">Haushaltskosten</h2>
            <p style="font-size:14px;color:#666;">Monatl. Netto-Einkommen: <strong>€ <?php echo $einkommen; ?></strong></p>
            <table style="width:100%;font-size:14px;margin-bottom:20px;border-collapse:collapse;" cellpadding="6">
                <tr style="background:#fdf8e8;"><th style="text-align:left;">Kategorie</th><th style="text-align:right;">Betrag</th><th style="text-align:right;">Anteil</th><th style="text-align:right;">Optimal</th></tr>
                <?php foreach ( $kategorien as $kat ) : ?>
                <tr style="border-bottom:1px solid #f0f0f0;">
                    <td><?php echo esc_html( $kat['name'] ); ?></td>
                    <td style="text-align:right;">€ <?php echo number_format( floatval( $kat['betrag'] ), 0, ',', '.' ); ?></td>
                    <td style="text-align:right;"><?php echo intval( $kat['prozent'] ); ?>%</td>
                    <td style="text-align:right;"><?php echo intval( $kat['optimal'] ); ?>%</td>
                </tr>
                <?php endforeach; ?>
            </table>

            <!-- Versicherungen Detail -->
            <?php if ( ! empty( $versicherungen ) ) : ?>
            <h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">Versicherungen – Detail</h2>
            <table style="width:100%;font-size:14px;margin-bottom:20px;border-collapse:collapse;" cellpadding="4">
                <tr style="background:#fdf8e8;"><th style="text-align:left;">Sparte</th><th style="text-align:right;">Prämie</th><th style="text-align:left;">Gesellschaft</th><th>Info</th></tr>
                <?php
                $vers_labels = array(
                    'eigenheim' => 'Eigenheim', 'haushalt' => 'Haushalt', 'haftpflicht' => 'Haftpflicht',
                    'rechtsschutz' => 'Rechtsschutz', 'unfall' => 'Unfall', 'kranken' => 'Kranken',
                    'berufsunfaehigkeit' => 'BU', 'kfzvers' => 'KFZ', 'ableben' => 'Ableben', 'sonstige' => 'Sonstige',
                );
                foreach ( $vers_labels as $key => $label ) :
                    $v = $versicherungen[ $key ] ?? array();
                    $betrag = floatval( $v['betrag'] ?? 0 );
                    if ( $betrag <= 0 && empty( $v['gesellschaft'] ?? '' ) ) continue;
                    $info = '';
                    if ( ! empty( $v['qm'] ) ) $info = $v['qm'] . ' m²';
                    if ( ! empty( $v['bmstufe'] ) ) $info = 'BM ' . $v['bmstufe'];
                ?>
                <tr style="border-bottom:1px solid #f0f0f0;">
                    <td><?php echo esc_html( $label ); ?></td>
                    <td style="text-align:right;">€ <?php echo number_format( $betrag, 0, ',', '.' ); ?></td>
                    <td><?php echo esc_html( $v['gesellschaft'] ?? '—' ); ?></td>
                    <td><?php echo esc_html( $info ?: '—' ); ?></td>
                </tr>
                <?php endforeach; ?>
            </table>
            <?php endif; ?>

            <!-- Sparen Detail -->
            <?php if ( ! empty( $sparen_data ) ) : ?>
            <h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">Sparen / Investment – Detail</h2>
            <table style="width:100%;font-size:14px;margin-bottom:20px;" cellpadding="4">
                <?php if ( ! empty( $sparen_data['giroKontostand'] ) || ! empty( $sparen_data['giroBank'] ) ) : ?>
                <tr><td style="color:#999;width:180px;">Girokonto</td><td>Kontostand: € <?php echo number_format( floatval( $sparen_data['giroKontostand'] ?? 0 ), 0, ',', '.' ); ?> · <?php echo esc_html( $sparen_data['giroBank'] ?? '—' ); ?></td></tr>
                <?php endif; ?>
                <?php if ( ! empty( $sparen_data['sparMonatlich'] ) || ! empty( $sparen_data['sparKontostand'] ) ) : ?>
                <tr><td style="color:#999;">Sparkonto</td><td>Mtl.: € <?php echo number_format( floatval( $sparen_data['sparMonatlich'] ?? 0 ), 0, ',', '.' ); ?> · Kontostand: € <?php echo number_format( floatval( $sparen_data['sparKontostand'] ?? 0 ), 0, ',', '.' ); ?></td></tr>
                <?php endif; ?>
                <?php if ( ! empty( $sparen_data['bausparerMonatlich'] ) || ! empty( $sparen_data['bausparerKontostand'] ) ) : ?>
                <tr><td style="color:#999;">Bausparer</td><td>Mtl.: € <?php echo number_format( floatval( $sparen_data['bausparerMonatlich'] ?? 0 ), 0, ',', '.' ); ?> · Kontostand: € <?php echo number_format( floatval( $sparen_data['bausparerKontostand'] ?? 0 ), 0, ',', '.' ); ?></td></tr>
                <?php endif; ?>
                <?php if ( ! empty( $sparen_data['fonds'] ) ) : ?>
                    <?php foreach ( $sparen_data['fonds'] as $fonds ) : ?>
                    <tr><td style="color:#999;">Fonds/ETF</td><td><?php echo esc_html( $fonds['name'] ?? '—' ); ?> (<?php echo esc_html( $fonds['isin'] ?? '—' ); ?>) · Mtl.: € <?php echo number_format( floatval( $fonds['monatlich'] ?? 0 ), 0, ',', '.' ); ?> · Kontostand: € <?php echo number_format( floatval( $fonds['kontostand'] ?? 0 ), 0, ',', '.' ); ?></td></tr>
                    <?php endforeach; ?>
                <?php endif; ?>
                <?php if ( ! empty( $sparen_data['lvMonatlich'] ) || ! empty( $sparen_data['lvGesellschaft'] ) ) : ?>
                <tr><td style="color:#999;">Lebensversicherung</td><td>Mtl.: € <?php echo number_format( floatval( $sparen_data['lvMonatlich'] ?? 0 ), 0, ',', '.' ); ?> · <?php echo esc_html( $sparen_data['lvGesellschaft'] ?? '—' ); ?></td></tr>
                <?php endif; ?>
            </table>
            <?php endif; ?>

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
