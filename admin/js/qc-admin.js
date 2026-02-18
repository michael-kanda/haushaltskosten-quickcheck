/* ═══════════════════════════════════════════════════════
   Quickcheck Admin Dashboard – JavaScript
   ═══════════════════════════════════════════════════════ */
(function ($) {
    'use strict';

    var partners = {};
    var deleteKey = '';

    /* ══════════ Init ══════════ */
    $(document).ready(function () {
        initRoleSelect();
        loadPartners();
        bindEvents();
    });

    /* ══════════ Rollen-Dropdown befüllen ══════════ */
    function initRoleSelect() {
        var $sel = $('#qc-form-role');
        if (qcAdmin.roles && qcAdmin.roles.length) {
            $.each(qcAdmin.roles, function (_, role) {
                $sel.append($('<option>').val(role).text(role));
            });
        }
    }

    /* ══════════ Events ══════════ */
    function bindEvents() {
        /* Modal: Neuen Partner */
        $('#qc-btn-add').on('click', function () {
            resetForm();
            $('#qc-form-mode').val('add');
            $('#qc-modal-title').text('Neuen Partner anlegen');
            $('#qc-form-key').prop('disabled', false);
            openModal('qc-modal-overlay');
        });

        /* Modal: Schließen */
        $('#qc-modal-close, #qc-modal-cancel').on('click', function () {
            closeModal('qc-modal-overlay');
        });
        $('#qc-delete-close, #qc-delete-cancel').on('click', function () {
            closeModal('qc-delete-overlay');
        });

        /* Overlay-Klick schließt Modal */
        $('.qc-modal-overlay').on('click', function (e) {
            if ($(e.target).hasClass('qc-modal-overlay')) {
                closeModal(this.id);
            }
        });

        /* ESC schließt Modals */
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape') {
                closeModal('qc-modal-overlay');
                closeModal('qc-delete-overlay');
            }
        });

        /* Speichern */
        $('#qc-modal-save').on('click', savePartner);

        /* Enter im Formular */
        $('#qc-partner-form').on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                savePartner();
            }
        });

        /* Löschen bestätigen */
        $('#qc-delete-confirm').on('click', confirmDelete);

        /* Suche */
        $('#qc-search').on('input', filterTable);

        /* Reset */
        $('#qc-btn-reset').on('click', function () {
            if (confirm('Alle Partner auf die Standard-Werte zurücksetzen? Manuelle Änderungen gehen verloren.')) {
                resetPartners();
            }
        });

        /* Delegated: Edit / Delete / Copy-Link */
        $('#qc-partner-tbody').on('click', '.qc-action-edit', function () {
            var key = $(this).data('key');
            openEditModal(key);
        });

        $('#qc-partner-tbody').on('click', '.qc-action-delete', function () {
            var key = $(this).data('key');
            openDeleteModal(key);
        });

        $('#qc-partner-tbody').on('click', '.qc-link-copy', function () {
            var text = $(this).data('link');
            copyToClipboard(text);
            var $el = $(this).find('.qc-link-copy__text');
            var orig = $el.text();
            $el.text('Kopiert!');
            setTimeout(function () { $el.text(orig); }, 1200);
        });
    }

    /* ══════════ AJAX: Load ══════════ */
    function loadPartners() {
        $.post(qcAdmin.ajaxUrl, {
            action: 'qc_admin_get_partners',
            nonce:  qcAdmin.nonce
        }, function (res) {
            if (res.success) {
                partners = res.data;
                renderTable();
                renderStats();
            } else {
                showNotice('error', 'Fehler beim Laden der Partner.');
            }
        });
    }

    /* ══════════ AJAX: Save ══════════ */
    function savePartner() {
        var key   = $.trim($('#qc-form-key').val()).toLowerCase().replace(/[^a-z0-9]/g, '');
        var name  = $.trim($('#qc-form-name').val());
        var email = $.trim($('#qc-form-email').val());
        var role  = $('#qc-form-role').val();
        var phone = $.trim($('#qc-form-phone').val());
        var mode  = $('#qc-form-mode').val();
        var originalKey = $('#qc-form-original-key').val();

        /* Client-Validierung */
        if (!key) { showNotice('error', 'Bitte Kürzel eingeben.'); return; }
        if (!name) { showNotice('error', 'Bitte Name eingeben.'); return; }
        if (!email || email.indexOf('@') === -1) { showNotice('error', 'Bitte gültige E-Mail eingeben.'); return; }

        $('#qc-modal-save').prop('disabled', true).text('Speichern…');

        $.post(qcAdmin.ajaxUrl, {
            action:       'qc_admin_save_partner',
            nonce:        qcAdmin.nonce,
            key:          key,
            original_key: originalKey,
            mode:         mode,
            name:         name,
            email:        email,
            role:         role,
            phone:        phone
        }, function (res) {
            $('#qc-modal-save').prop('disabled', false).text('Speichern');
            if (res.success) {
                partners = res.data.partners;
                renderTable();
                renderStats();
                closeModal('qc-modal-overlay');
                showNotice('success', res.data.message);
            } else {
                showNotice('error', res.data || 'Fehler beim Speichern.');
            }
        }).fail(function () {
            $('#qc-modal-save').prop('disabled', false).text('Speichern');
            showNotice('error', 'Netzwerkfehler.');
        });
    }

    /* ══════════ AJAX: Delete ══════════ */
    function confirmDelete() {
        if (!deleteKey) return;

        $('#qc-delete-confirm').prop('disabled', true).text('Löschen…');

        $.post(qcAdmin.ajaxUrl, {
            action: 'qc_admin_delete_partner',
            nonce:  qcAdmin.nonce,
            key:    deleteKey
        }, function (res) {
            $('#qc-delete-confirm').prop('disabled', false).text('Löschen');
            if (res.success) {
                partners = res.data.partners;
                renderTable();
                renderStats();
                closeModal('qc-delete-overlay');
                showNotice('success', res.data.message);
            } else {
                showNotice('error', res.data || 'Fehler beim Löschen.');
            }
        }).fail(function () {
            $('#qc-delete-confirm').prop('disabled', false).text('Löschen');
            showNotice('error', 'Netzwerkfehler.');
        });
    }

    /* ══════════ AJAX: Reset ══════════ */
    function resetPartners() {
        $.post(qcAdmin.ajaxUrl, {
            action: 'qc_admin_reset_partners',
            nonce:  qcAdmin.nonce
        }, function (res) {
            if (res.success) {
                partners = res.data.partners;
                renderTable();
                renderStats();
                showNotice('success', res.data.message);
            } else {
                showNotice('error', res.data || 'Fehler beim Zurücksetzen.');
            }
        });
    }

    /* ══════════ Render: Table ══════════ */
    function renderTable() {
        var $tbody = $('#qc-partner-tbody');
        $tbody.empty();

        var keys = Object.keys(partners);

        if (!keys.length) {
            $tbody.append('<tr><td colspan="7" class="qc-empty">Noch keine Partner angelegt.</td></tr>');
            return;
        }

        /* Sortieren nach Name */
        keys.sort(function (a, b) {
            return (partners[a].name || '').localeCompare(partners[b].name || '');
        });

        $.each(keys, function (_, key) {
            var p = partners[key];
            var link = qcAdmin.homeUrl + '?partner=' + key;

            var row = '<tr data-key="' + esc(key) + '">' +
                '<td><span class="qc-badge">' + esc(key) + '</span></td>' +
                '<td><strong>' + esc(p.name) + '</strong></td>' +
                '<td>' + esc(p.email) + '</td>' +
                '<td>' + (p.role ? '<span class="qc-role-tag">' + esc(p.role) + '</span>' : '<span style="color:#ccc;">–</span>') + '</td>' +
                '<td>' + (p.phone || '<span style="color:#ccc;">–</span>') + '</td>' +
                '<td>' +
                    '<span class="qc-link-copy" data-link="' + esc(link) + '" title="Link kopieren">' +
                        '<span class="dashicons dashicons-admin-links"></span>' +
                        '<span class="qc-link-copy__text">?partner=' + esc(key) + '</span>' +
                    '</span>' +
                '</td>' +
                '<td class="qc-col-actions">' +
                    '<div class="qc-actions">' +
                        '<button type="button" class="qc-action-edit" data-key="' + esc(key) + '" title="Bearbeiten"><span class="dashicons dashicons-edit"></span></button>' +
                        '<button type="button" class="qc-action-delete" data-key="' + esc(key) + '" title="Löschen"><span class="dashicons dashicons-trash"></span></button>' +
                    '</div>' +
                '</td>' +
                '</tr>';

            $tbody.append(row);
        });
    }

    /* ══════════ Render: Stats ══════════ */
    function renderStats() {
        var keys = Object.keys(partners);
        var totalPartners = keys.length;

        var roles = {};
        $.each(keys, function (_, key) {
            var role = partners[key].role || 'Ohne Rolle';
            roles[role] = (roles[role] || 0) + 1;
        });

        var topRole = '';
        var topCount = 0;
        $.each(roles, function (r, c) {
            if (c > topCount) { topRole = r; topCount = c; }
        });

        var html =
            '<div class="qc-stat-card">' +
                '<div class="qc-stat-card__icon qc-stat-card__icon--gold">👥</div>' +
                '<div><div class="qc-stat-card__value">' + totalPartners + '</div><div class="qc-stat-card__label">Partner gesamt</div></div>' +
            '</div>' +
            '<div class="qc-stat-card">' +
                '<div class="qc-stat-card__icon qc-stat-card__icon--dark">🏷️</div>' +
                '<div><div class="qc-stat-card__value">' + Object.keys(roles).length + '</div><div class="qc-stat-card__label">Verschiedene Rollen</div></div>' +
            '</div>' +
            '<div class="qc-stat-card">' +
                '<div class="qc-stat-card__icon qc-stat-card__icon--gold">⭐</div>' +
                '<div><div class="qc-stat-card__value">' + esc(topRole || '–') + '</div><div class="qc-stat-card__label">Häufigste Rolle (' + topCount + '×)</div></div>' +
            '</div>';

        $('#qc-stats-row').html(html);
    }

    /* ══════════ Filter / Suche ══════════ */
    function filterTable() {
        var q = $.trim($(this).val()).toLowerCase();
        $('#qc-partner-tbody tr').each(function () {
            var text = $(this).text().toLowerCase();
            $(this).toggle(text.indexOf(q) !== -1);
        });
    }

    /* ══════════ Modal: Edit ══════════ */
    function openEditModal(key) {
        var p = partners[key];
        if (!p) return;

        resetForm();
        $('#qc-form-mode').val('edit');
        $('#qc-form-original-key').val(key);
        $('#qc-modal-title').text('Partner bearbeiten');

        $('#qc-form-key').val(key);
        $('#qc-form-name').val(p.name);
        $('#qc-form-email').val(p.email);
        $('#qc-form-role').val(p.role || '');
        $('#qc-form-phone').val(p.phone || '');

        openModal('qc-modal-overlay');
    }

    /* ══════════ Modal: Delete ══════════ */
    function openDeleteModal(key) {
        var p = partners[key];
        if (!p) return;

        deleteKey = key;
        $('#qc-delete-name').text(p.name);
        $('#qc-delete-key').text(key);
        openModal('qc-delete-overlay');
    }

    /* ══════════ Modal Helpers ══════════ */
    function openModal(id) {
        $('#' + id).fadeIn(150);
        $('body').css('overflow', 'hidden');
    }

    function closeModal(id) {
        $('#' + id).fadeOut(100);
        /* Prüfe ob noch ein anderes Modal offen ist */
        setTimeout(function () {
            if (!$('.qc-modal-overlay:visible').length) {
                $('body').css('overflow', '');
            }
        }, 120);
    }

    function resetForm() {
        $('#qc-partner-form')[0].reset();
        $('#qc-form-mode').val('add');
        $('#qc-form-original-key').val('');
        $('#qc-form-key').prop('disabled', false);
    }

    /* ══════════ Notice ══════════ */
    function showNotice(type, msg) {
        var icon = type === 'success' ? '✅' : '⚠️';
        var html =
            '<div class="qc-notice qc-notice--' + type + '">' +
                '<span>' + icon + ' ' + esc(msg) + '</span>' +
                '<button type="button" class="qc-notice__dismiss" onclick="this.parentElement.remove()">×</button>' +
            '</div>';

        var $el = $(html);
        $('#qc-notices').prepend($el);

        /* Auto-dismiss nach 5 Sek */
        setTimeout(function () {
            $el.fadeOut(300, function () { $(this).remove(); });
        }, 5000);
    }

    /* ══════════ Clipboard ══════════ */
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
        } else {
            var $tmp = $('<input>').val(text).appendTo('body').select();
            document.execCommand('copy');
            $tmp.remove();
        }
    }

    /* ══════════ HTML Escape ══════════ */
    function esc(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

})(jQuery);
