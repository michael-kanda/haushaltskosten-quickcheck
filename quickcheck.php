<?php
/**
 * Plugin Name: Haushaltskosten Quickcheck
 * Plugin URI:  https://pro-finanz.at
 * Description: Finanz-Quickcheck Wizard mit Haushaltskosten-Analyse. Shortcode: [quickcheck] — optional mit Partner-ID: [quickcheck partner="rh"]
 * Version:     2.1.0
 * Author:      Pro-Finanz
 * Text Domain: quickcheck
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'QC_VERSION', '2.1.0' );
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

    /* Google Font */
    wp_enqueue_style( 'qc-outfit-font',
        'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
        array(), null );

    /* Plugin CSS */
    wp_enqueue_style( 'qc-styles',
        QC_URL . 'css/quickcheck.css', array(), QC_VERSION );

    /* React 18 */
    wp_enqueue_script( 'qc-react',
        'https://unpkg.com/react@18.2.0/umd/react.production.min.js',
        array(), '18.2.0', true );
    wp_enqueue_script( 'qc-react-dom',
        'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js',
        array( 'qc-react' ), '18.2.0', true );

    /* prop-types — Recharts braucht das als Global */
    wp_enqueue_script( 'qc-prop-types',
        'https://unpkg.com/prop-types@15.8.1/prop-types.min.js',
        array( 'qc-react' ), '15.8.1', true );

    /* Recharts — pinned version mit allen Dependencies */
    wp_enqueue_script( 'qc-recharts',
        'https://unpkg.com/recharts@2.12.7/umd/Recharts.js',
        array( 'qc-react', 'qc-react-dom', 'qc-prop-types' ), '2.12.7', true );

    /* App — normales JS, kein Babel nötig */
    wp_enqueue_script( 'qc-app',
        QC_URL . 'js/quickcheck-app.js',
        array( 'qc-react', 'qc-react-dom', 'qc-prop-types', 'qc-recharts' ),
        QC_VERSION, true );

    /* PHP → JS Daten */
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

/* ── HTML E-Mail ── */
function qc_build_email_body( $payload, $partner ) {
    $kontakt    = $payload['kontakt'] ?? array();
    $quickcheck = $payload['quickcheck'] ?? array();
    $kategorien = $payload['kategorien'] ?? array();
    $einkommen  = number_format( floatval( $payload['einkommen'] ?? 0 ), 0, ',', '.' );
    $vollmacht  = ! empty( $payload['vollmacht'] ) ? 'Ja' : 'Nein';
    $signatur   = ( $payload['signatur'] ?? 'keine' ) === 'vorhanden' ? '✔ Vorhanden' : '✗ Keine';

    ob_start();
    ?>
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="UTF-8"></head>
    <body style="font-family:'Outfit',Arial,sans-serif;color:#1a1b25;background:#f9f9f9;padding:20px;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #e5e5e5;">
        <div style="background:linear-gradient(90deg,#c6a559,#f5d86b);padding:24px 30px;">
            <h1 style="margin:0;font-size:22px;color:#1a1b25;">📊 Quickcheck-Ergebnis</h1>
            <p style="margin:6px 0 0;font-size:14px;color:#5a5030;">
                <?php echo esc_html( $kontakt['name'] ?? 'Unbekannt' ); ?>
                <?php if ( $partner ) : ?> · Berater: <?php echo esc_html( $partner['name'] ); ?><?php endif; ?>
            </p>
        </div>
        <div style="padding:24px 30px;">
            <h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">Kontaktdaten</h2>
            <table style="width:100%;font-size:14px;margin-bottom:20px;" cellpadding="4">
                <tr><td style="color:#999;width:140px;">Name</td><td><strong><?php echo esc_html( $kontakt['name'] ?? '—' ); ?></strong></td></tr>
                <tr><td style="color:#999;">E-Mail</td><td><?php echo esc_html( $kontakt['email'] ?? '—' ); ?></td></tr>
                <tr><td style="color:#999;">Telefon</td><td><?php echo esc_html( $kontakt['telefon'] ?? '—' ); ?></td></tr>
            </table>
            <h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">Quickcheck-Antworten</h2>
            <table style="width:100%;font-size:14px;margin-bottom:20px;" cellpadding="4">
            <?php
            $labels = array(
                'lebenssituation' => 'Lebenssituation', 'themen' => 'Aktuelle Themen',
                'themenSonstig' => 'Sonstiges (Themen)', 'prioritaeten' => 'Prioritäten',
                'wohnen' => 'Wohnen & Immobilie', 'familie' => 'Familie & Zukunft',
                'pensionGefuehl' => 'Pension – Gefühl', 'zukunftWunsch' => 'Zukunftswunsch',
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
                    <td style="color:#999;width:180px;vertical-align:top;"><?php echo esc_html( $label ); ?></td>
                    <td><?php echo esc_html( $val ); ?></td>
                </tr>
            <?php endforeach; ?>
            </table>
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
            <h2 style="font-size:16px;border-bottom:2px solid #f5d86b;padding-bottom:6px;">Vollmacht</h2>
            <table style="width:100%;font-size:14px;" cellpadding="4">
                <tr><td style="color:#999;width:140px;">Vollmacht erteilt</td><td><strong><?php echo $vollmacht; ?></strong></td></tr>
                <tr><td style="color:#999;">Unterschrift</td><td><?php echo $signatur; ?></td></tr>
            </table>
        </div>
        <div style="background:#fafafa;padding:16px 30px;font-size:12px;color:#999;border-top:1px solid #eee;">
            Gesendet am <?php echo date_i18n( 'd.m.Y \u\m H:i', current_time( 'timestamp' ) ); ?> Uhr · pro-finanz.at Quickcheck
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
    /* Initiale Partner-Daten in DB schreiben falls noch nicht vorhanden */
    QC_Partners::get_all();
});
