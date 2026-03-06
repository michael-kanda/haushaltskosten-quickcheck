<?php
/**
 * QC_Admin – WordPress Admin-Seite für Partner-Verwaltung
 *
 * @package Quickcheck
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class QC_Admin {

    public function __construct() {
        add_action( 'admin_menu',            array( $this, 'register_menu' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );

        /* AJAX Endpoints */
        add_action( 'wp_ajax_qc_admin_get_partners',    array( $this, 'ajax_get_partners' ) );
        add_action( 'wp_ajax_qc_admin_save_partner',    array( $this, 'ajax_save_partner' ) );
        add_action( 'wp_ajax_qc_admin_delete_partner',  array( $this, 'ajax_delete_partner' ) );
        add_action( 'wp_ajax_qc_admin_reset_partners',  array( $this, 'ajax_reset_partners' ) );
    }

    /* ═══════════ Menü ═══════════ */
    public function register_menu() {
        add_menu_page(
            'Quickcheck',
            'Quickcheck',
            'manage_options',
            'quickcheck',
            array( $this, 'render_page' ),
            'dashicons-chart-pie',
            30
        );

        add_submenu_page(
            'quickcheck',
            'Partner verwalten',
            'Partner',
            'manage_options',
            'quickcheck',
            array( $this, 'render_page' )
        );

        add_submenu_page(
            'quickcheck',
            'Quickcheck Einstellungen',
            'Einstellungen',
            'manage_options',
            'quickcheck-settings',
            array( $this, 'render_settings_page' )
        );
    }

    /* ═══════════ Assets ═══════════ */
    public function enqueue_assets( $hook ) {
        /* Nur auf unserer Seite laden */
        if ( strpos( $hook, 'quickcheck' ) === false ) {
            return;
        }

        wp_enqueue_style(
            'qc-admin-styles',
            QC_URL . 'admin/css/qc-admin.css',
            array(),
            QC_VERSION
        );

        wp_enqueue_script(
            'qc-admin-app',
            QC_URL . 'admin/js/qc-admin.js',
            array( 'jquery' ),
            QC_VERSION,
            true
        );

        wp_localize_script( 'qc-admin-app', 'qcAdmin', array(
            'ajaxUrl'       => admin_url( 'admin-ajax.php' ),
            'nonce'         => wp_create_nonce( 'qc_admin_nonce' ),
            'homeUrl'       => home_url( '/' ),
            'quickcheckUrl' => qc_get_page_url(),
            'roles'         => array(
                'Geschäftsführer',
                'Regionalleiter',
                'Gebietsleiter',
                'Vertriebsmitarbeiter',
            ),
        ) );
    }

    /* ═══════════ Seiten-Render ═══════════ */
    public function render_page() {
        ?>
        <div class="wrap qc-admin-wrap">
            <div class="qc-admin-header">
                <div class="qc-admin-header__left">
                    <h1>📊 Quickcheck – Partner-Verwaltung</h1>
                    <p class="qc-admin-header__sub">Partner hinzufügen, bearbeiten und Kürzel-Links für den Versand verwalten.</p>
                </div>
                <div class="qc-admin-header__actions">
                    <button type="button" id="qc-btn-add" class="button button-primary qc-btn-gold">
                        <span class="dashicons dashicons-plus-alt2"></span> Neuen Partner anlegen
                    </button>
                </div>
            </div>

            <!-- Benachrichtigungen -->
            <div id="qc-notices"></div>

            <!-- Statistik-Karten -->
            <div class="qc-stats-row" id="qc-stats-row"></div>

            <!-- Partner-Tabelle -->
            <div class="qc-card">
                <div class="qc-card__header">
                    <h2>Alle Partner</h2>
                    <div class="qc-card__header-actions">
                        <input type="search" id="qc-search" class="qc-search" placeholder="Partner suchen…">
                        <button type="button" id="qc-btn-reset" class="button qc-btn-outline" title="Auf Standard zurücksetzen">
                            <span class="dashicons dashicons-image-rotate"></span> Reset
                        </button>
                    </div>
                </div>
                <div class="qc-table-wrap">
                    <table class="qc-table" id="qc-partner-table">
                        <thead>
                            <tr>
                                <th>Kürzel</th>
                                <th>Name</th>
                                <th>E-Mail</th>
                                <th>Rolle</th>
                                <th>Telefon</th>
                                <th>Partner-Link</th>
                                <th class="qc-col-actions">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody id="qc-partner-tbody">
                            <tr><td colspan="7" class="qc-loading">Laden…</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Shortcode-Info -->
            <div class="qc-card qc-card--info">
                <h3>📋 Shortcode-Verwendung</h3>
                <div class="qc-shortcode-grid">
                    <div class="qc-shortcode-item">
                        <code>[quickcheck]</code>
                        <span>Ohne Partner (Fallback auf Admin-E-Mail)</span>
                    </div>
                    <div class="qc-shortcode-item">
                        <code>[quickcheck partner="rh"]</code>
                        <span>Mit Partner-Kürzel</span>
                    </div>
                    <div class="qc-shortcode-item">
                        <code>?partner=rh</code>
                        <span>Per URL-Parameter (Partner-Link)</span>
                    </div>
                </div>
            </div>

            <!-- Modal: Partner anlegen/bearbeiten -->
            <div id="qc-modal-overlay" class="qc-modal-overlay" style="display:none;">
                <div class="qc-modal">
                    <div class="qc-modal__header">
                        <h2 id="qc-modal-title">Neuen Partner anlegen</h2>
                        <button type="button" class="qc-modal__close" id="qc-modal-close">&times;</button>
                    </div>
                    <form id="qc-partner-form" class="qc-modal__body">
                        <input type="hidden" id="qc-form-mode" value="add">
                        <input type="hidden" id="qc-form-original-key" value="">

                        <div class="qc-form-row">
                            <div class="qc-form-group qc-form-group--short">
                                <label for="qc-form-key">Kürzel *</label>
                                <input type="text" id="qc-form-key" maxlength="10" pattern="[a-zA-Z0-9]+" required placeholder="z.B. rh">
                                <span class="qc-form-hint">Nur Buchstaben & Zahlen, max. 10 Zeichen</span>
                            </div>
                            <div class="qc-form-group">
                                <label for="qc-form-name">Name *</label>
                                <input type="text" id="qc-form-name" required placeholder="Vor- und Nachname">
                            </div>
                        </div>

                        <div class="qc-form-row">
                            <div class="qc-form-group">
                                <label for="qc-form-email">E-Mail *</label>
                                <input type="email" id="qc-form-email" required placeholder="email@pro-finanz.at">
                            </div>
                            <div class="qc-form-group">
                                <label for="qc-form-role">Rolle</label>
                                <select id="qc-form-role">
                                    <option value="">– Bitte wählen –</option>
                                </select>
                            </div>
                        </div>

                        <div class="qc-form-row">
                            <div class="qc-form-group">
                                <label for="qc-form-phone">Telefon</label>
                                <input type="tel" id="qc-form-phone" placeholder="+43 …">
                            </div>
                        </div>
                    </form>
                    <div class="qc-modal__footer">
                        <button type="button" id="qc-modal-cancel" class="button">Abbrechen</button>
                        <button type="button" id="qc-modal-save" class="button button-primary qc-btn-gold">Speichern</button>
                    </div>
                </div>
            </div>

            <!-- Modal: Lösch-Bestätigung -->
            <div id="qc-delete-overlay" class="qc-modal-overlay" style="display:none;">
                <div class="qc-modal qc-modal--sm">
                    <div class="qc-modal__header">
                        <h2>Partner löschen?</h2>
                        <button type="button" class="qc-modal__close" id="qc-delete-close">&times;</button>
                    </div>
                    <div class="qc-modal__body">
                        <p>Soll <strong id="qc-delete-name"></strong> (<code id="qc-delete-key"></code>) wirklich gelöscht werden?</p>
                        <p class="qc-text-muted">Bestehende Shortcodes und Links mit diesem Kürzel funktionieren danach nicht mehr korrekt.</p>
                    </div>
                    <div class="qc-modal__footer">
                        <button type="button" id="qc-delete-cancel" class="button">Abbrechen</button>
                        <button type="button" id="qc-delete-confirm" class="button qc-btn-danger">Löschen</button>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }

    /* ═══════════ Einstellungen ═══════════ */
    public function render_settings_page() {
        /* Speichern */
        if ( isset( $_POST['qc_save_settings'] ) && wp_verify_nonce( $_POST['_wpnonce'] ?? '', 'qc_settings_nonce' ) ) {
            $url = esc_url_raw( trim( $_POST['qc_page_url'] ?? '' ) );
            update_option( 'qc_page_url', $url );

            $send_copy = ! empty( $_POST['qc_send_admin_copy'] );
            update_option( 'qc_send_admin_copy', $send_copy );

            echo '<div class="notice notice-success is-dismissible"><p>Einstellungen gespeichert.</p></div>';
        }

        /* Reset Auto-Detect */
        if ( isset( $_POST['qc_reset_url'] ) && wp_verify_nonce( $_POST['_wpnonce'] ?? '', 'qc_settings_nonce' ) ) {
            delete_option( 'qc_page_url' );
            echo '<div class="notice notice-success is-dismissible"><p>URL zurückgesetzt — wird automatisch neu erkannt.</p></div>';
        }

        $current_url    = get_option( 'qc_page_url', '' );
        $detected_url   = qc_get_page_url();
        $send_admin_copy = get_option( 'qc_send_admin_copy', false );
        ?>
        <div class="wrap qc-admin-wrap">
            <div class="qc-admin-header">
                <h1>⚙️ Quickcheck – Einstellungen</h1>
                <p class="qc-admin-header__sub">Allgemeine Plugin-Einstellungen</p>
            </div>
            <div class="qc-card" style="max-width:700px;">
                <div style="padding:20px 24px;">
                    <h3 style="margin-top:0;">🔗 Quickcheck-Seiten-URL</h3>
                    <p style="color:#666;font-size:14px;">Diese URL wird für die Partner-Links verwendet. Das Plugin versucht automatisch die Seite mit dem <code>[quickcheck]</code> Shortcode zu finden. Falls das nicht klappt, kannst du die URL hier manuell setzen.</p>
                    <form method="post">
                        <?php wp_nonce_field( 'qc_settings_nonce' ); ?>
                        <table class="form-table">
                            <tr>
                                <th><label for="qc_page_url">Seiten-URL</label></th>
                                <td>
                                    <input type="url" name="qc_page_url" id="qc_page_url" value="<?php echo esc_attr( $current_url ); ?>" class="regular-text" placeholder="<?php echo esc_attr( $detected_url ); ?>">
                                    <p class="description">
                                        Aktuell erkannte URL: <code><?php echo esc_html( $detected_url ); ?></code>
                                    </p>
                                </td>
                            </tr>
                        </table>

                        <h3>📧 E-Mail-Versand</h3>
                        <table class="form-table">
                            <tr>
                                <th><label for="qc_send_admin_copy">Admin-Kopie</label></th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="qc_send_admin_copy" id="qc_send_admin_copy" value="1" <?php checked( $send_admin_copy ); ?>>
                                        Kopie jeder Quickcheck-Einreichung an Admin senden
                                    </label>
                                    <p class="description">
                                        Wenn aktiviert, erhält <code><?php echo esc_html( get_option( 'admin_email' ) ); ?></code> eine Kopie jeder E-Mail, die an einen Partner geht. Die Kopie wird mit dem Betreff-Prefix <code>[Kopie]</code> versehen.
                                    </p>
                                </td>
                            </tr>
                        </table>

                        <p class="submit">
                            <button type="submit" name="qc_save_settings" class="button button-primary qc-btn-gold">Speichern</button>
                            <button type="submit" name="qc_reset_url" class="button" style="margin-left:8px;">Auto-Detect zurücksetzen</button>
                        </p>
                    </form>
                </div>
            </div>
        </div>
        <?php
    }

    /* ═══════════════════════════════════════
       AJAX Handlers
       ═══════════════════════════════════════ */

    private function verify_nonce() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Keine Berechtigung.', 403 );
        }
        if ( ! wp_verify_nonce( $_POST['nonce'] ?? '', 'qc_admin_nonce' ) ) {
            wp_send_json_error( 'Ungültige Anfrage.', 403 );
        }
    }

    public function ajax_get_partners() {
        $this->verify_nonce();
        wp_send_json_success( QC_Partners::get_all() );
    }

    public function ajax_save_partner() {
        $this->verify_nonce();

        $key          = sanitize_text_field( $_POST['key'] ?? '' );
        $original_key = sanitize_text_field( $_POST['original_key'] ?? '' );
        $mode         = sanitize_text_field( $_POST['mode'] ?? 'add' );

        $data = array(
            'name'  => sanitize_text_field( $_POST['name'] ?? '' ),
            'email' => sanitize_email( $_POST['email'] ?? '' ),
            'role'  => sanitize_text_field( $_POST['role'] ?? '' ),
            'phone' => sanitize_text_field( $_POST['phone'] ?? '' ),
        );

        /* Bei Bearbeitung: wenn Kürzel geändert wurde, altes löschen */
        if ( $mode === 'edit' && $original_key && $original_key !== $key ) {
            /* Prüfe ob neues Kürzel schon existiert */
            if ( QC_Partners::exists( $key ) ) {
                wp_send_json_error( 'Das Kürzel "' . $key . '" ist bereits vergeben.' );
            }
            QC_Partners::delete( $original_key );
        }

        /* Bei Neuanlage prüfen ob Kürzel schon existiert */
        if ( $mode === 'add' && QC_Partners::exists( $key ) ) {
            wp_send_json_error( 'Das Kürzel "' . $key . '" ist bereits vergeben.' );
        }

        $result = QC_Partners::save( $key, $data );

        if ( is_wp_error( $result ) ) {
            wp_send_json_error( $result->get_error_message() );
        }

        wp_send_json_success( array(
            'message'  => $mode === 'edit' ? 'Partner aktualisiert.' : 'Partner angelegt.',
            'partners' => QC_Partners::get_all(),
        ) );
    }

    public function ajax_delete_partner() {
        $this->verify_nonce();

        $key    = sanitize_text_field( $_POST['key'] ?? '' );
        $result = QC_Partners::delete( $key );

        if ( is_wp_error( $result ) ) {
            wp_send_json_error( $result->get_error_message() );
        }

        wp_send_json_success( array(
            'message'  => 'Partner gelöscht.',
            'partners' => QC_Partners::get_all(),
        ) );
    }

    public function ajax_reset_partners() {
        $this->verify_nonce();

        $partners = QC_Partners::reset_to_defaults();

        wp_send_json_success( array(
            'message'  => 'Partner auf Standard zurückgesetzt.',
            'partners' => $partners,
        ) );
    }
}
