<?php
/**
 * QC_Partners – CRUD für Partner-Daten (wp_options basiert)
 *
 * @package Quickcheck
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class QC_Partners {

    const OPTION_KEY = 'qc_partners';

    /**
     * Standard-Partner (Migration der Hardcoded-Daten)
     */
    private static function defaults() {
        return array(
            'rh' => array( 'name' => 'Riccardo Hüttner',     'email' => 'riccardo.huettner@pro-finanz.at',   'role' => 'Geschäftsführer',        'phone' => '' ),
            'pp' => array( 'name' => 'Patrick Pichler',       'email' => 'patrick.pichler@pro-finanz.at',     'role' => 'Regionalleiter',         'phone' => '0681/10607628' ),
            'ab' => array( 'name' => 'Aleksandar Bumbes',     'email' => 'aleksandar.bumbes@pro-finanz.at',   'role' => 'Gebietsleiter',          'phone' => '0660/3658092' ),
            'mw' => array( 'name' => 'Michael Wimmer',        'email' => 'michael.wimmer@pro-finanz.at',      'role' => 'Vertriebsmitarbeiter',   'phone' => '0676/9301771' ),
            'md' => array( 'name' => 'Markus Dominik',        'email' => 'markus.dominik@pro-finanz.at',      'role' => 'Vertriebsmitarbeiter',   'phone' => '0660/9185556' ),
            'hs' => array( 'name' => 'Hosse Sargsjan',        'email' => 'hosse.sargsjan@pro-finanz.at',      'role' => 'Vertriebsmitarbeiter',   'phone' => '0676/4077445' ),
            'iy' => array( 'name' => 'Ismail Yilmaz',         'email' => 'ismail.yilmaz@pro-finanz.at',       'role' => 'Vertriebsmitarbeiter',   'phone' => '0676/3171671' ),
            'eh' => array( 'name' => 'Elias Hüttner',         'email' => 'elias.huettner@pro-finanz.at',      'role' => 'Geschäftsführer',        'phone' => '0670/7727191' ),
            'sb' => array( 'name' => 'Sabrina Bättig',        'email' => 'sabrina.baettig@pro-finanz.at',     'role' => 'Vertriebsmitarbeiter',   'phone' => '0650/3669633' ),
            'ch' => array( 'name' => 'Christoph Hillinger',   'email' => 'christoph.hillinger@pro-finanz.at', 'role' => 'Regionalleiter',         'phone' => '0676/9581022' ),
            'mg' => array( 'name' => 'Marcel Gruber',         'email' => 'marcel.gruber@pro-finanz.at',       'role' => 'Vertriebsmitarbeiter',   'phone' => '0650/6800081' ),
        );
    }

    /**
     * Alle Partner holen – falls leer, Defaults speichern
     */
    public static function get_all() {
        $partners = get_option( self::OPTION_KEY, null );

        if ( $partners === null ) {
            $partners = self::defaults();
            update_option( self::OPTION_KEY, $partners );
        }

        return is_array( $partners ) ? $partners : array();
    }

    /**
     * Einzelnen Partner holen
     */
    public static function get( $key ) {
        $partners = self::get_all();
        return isset( $partners[ $key ] ) ? $partners[ $key ] : null;
    }

    /**
     * Partner hinzufügen / aktualisieren
     */
    public static function save( $key, $data ) {
        $key = self::sanitize_key( $key );

        if ( empty( $key ) ) {
            return new WP_Error( 'invalid_key', 'Kürzel darf nicht leer sein.' );
        }

        if ( empty( $data['name'] ) || empty( $data['email'] ) ) {
            return new WP_Error( 'missing_fields', 'Name und E-Mail sind Pflichtfelder.' );
        }

        if ( ! is_email( $data['email'] ) ) {
            return new WP_Error( 'invalid_email', 'Ungültige E-Mail-Adresse.' );
        }

        $partners = self::get_all();

        $partners[ $key ] = array(
            'name'  => sanitize_text_field( $data['name'] ),
            'email' => sanitize_email( $data['email'] ),
            'role'  => sanitize_text_field( $data['role'] ?? '' ),
            'phone' => sanitize_text_field( $data['phone'] ?? '' ),
        );

        update_option( self::OPTION_KEY, $partners );

        return true;
    }

    /**
     * Partner löschen
     */
    public static function delete( $key ) {
        $partners = self::get_all();

        if ( ! isset( $partners[ $key ] ) ) {
            return new WP_Error( 'not_found', 'Partner nicht gefunden.' );
        }

        unset( $partners[ $key ] );
        update_option( self::OPTION_KEY, $partners );

        return true;
    }

    /**
     * Prüfen ob Kürzel bereits existiert
     */
    public static function exists( $key ) {
        $partners = self::get_all();
        return isset( $partners[ $key ] );
    }

    /**
     * Kürzel sanitizen: nur lowercase Buchstaben/Zahlen, max 10 Zeichen
     */
    public static function sanitize_key( $key ) {
        $key = strtolower( trim( $key ) );
        $key = preg_replace( '/[^a-z0-9]/', '', $key );
        return substr( $key, 0, 10 );
    }

    /**
     * Partner-Link generieren
     */
    public static function get_link( $key, $page_url = '' ) {
        if ( empty( $page_url ) ) {
            $page_url = home_url( '/' );
        }
        return add_query_arg( 'partner', $key, $page_url );
    }

    /**
     * Auf Defaults zurücksetzen
     */
    public static function reset_to_defaults() {
        $partners = self::defaults();
        update_option( self::OPTION_KEY, $partners );
        return $partners;
    }
}
