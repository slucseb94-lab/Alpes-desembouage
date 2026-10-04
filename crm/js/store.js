// Couche de données : même interface en mode démo (localStorage) et en mode réel (Supabase).
(function () {
  const cfg = window.CRM_CONFIG || {};
  const TABLES = ['profiles', 'clients', 'activities', 'quotes', 'appointments', 'payments'];
  const DEMO_KEY = 'crm-demo-v1';
  const DEMO_USER_KEY = 'crm-demo-user';

  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };

  const Store = {
    mode: 'demo',
    sb: null,
    user: null,
    needPassword: false,
    data: { profiles: [], clients: [], activities: [], quotes: [], appointments: [], payments: [], settings: {} },
    isAdmin() { return !!this.user && this.user.role === 'admin'; }
  };

  // ---------------------------------------------------------------- démo
  let demoDb = null;

  function demoLoad() {
    try { demoDb = JSON.parse(lsGet(DEMO_KEY)); } catch (e) { demoDb = null; }
    if (!demoDb || !demoDb.clients) { demoDb = seed(); demoSave(); }
    if (!demoDb.payments) { demoDb.payments = []; demoSave(); }
  }
  function demoSave() { lsSet(DEMO_KEY, JSON.stringify(demoDb)); }

  // Reproduit en local les règles d'accès appliquées par Supabase (voir supabase/schema.sql).
  function demoVisible() {
    const db = demoDb, u = Store.user;
    if (!u) return { profiles: db.profiles, clients: [], activities: [], quotes: [], appointments: [], payments: [] };
    if (u.role === 'admin') {
      return { profiles: db.profiles, clients: db.clients, activities: db.activities, quotes: db.quotes, appointments: db.appointments, payments: db.payments };
    }
    const appointments = db.appointments.filter((a) => a.technician_id === u.id);
    const apptIds = new Set(appointments.map((a) => a.id));
    const ids = new Set(appointments.map((a) => a.client_id));
    db.clients.forEach((c) => { if (c.assigned_to === u.id || c.created_by === u.id) ids.add(c.id); });
    return {
      profiles: db.profiles,
      clients: db.clients.filter((c) => ids.has(c.id)),
      activities: db.activities.filter((a) => ids.has(a.client_id)),
      quotes: [],
      appointments,
      payments: db.payments.filter((p) => p.created_by === u.id || apptIds.has(p.appointment_id))
    };
  }

  // ---------------------------------------------------------------- init / auth
  Store.init = async function () {
    if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
      this.mode = 'supabase';
      // Lien d'invitation ou de réinitialisation : l'utilisateur doit choisir un mot de passe.
      this.needPassword = /type=(invite|recovery)/.test(location.hash);
      this.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { data } = await this.sb.auth.getSession();
      if (data.session) await this._loadProfile(data.session.user);
      this.sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') this.needPassword = true; });
    } else {
      this.mode = 'demo';
      demoLoad();
      const id = lsGet(DEMO_USER_KEY);
      this.user = demoDb.profiles.find((p) => p.id === id && p.active) || null;
    }
  };

  Store._loadProfile = async function (authUser) {
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', authUser.id).single();
    if (error || !data) throw new Error("Profil introuvable. Contactez l'administrateur.");
    if (!data.active) { await this.sb.auth.signOut(); throw new Error('Ce compte est désactivé.'); }
    this.user = Object.assign({ email: authUser.email }, data);
  };

  Store.signIn = async function (email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : error.message);
    await this._loadProfile(data.user);
  };

  Store.signInDemo = function (profileId) {
    this.user = demoDb.profiles.find((p) => p.id === profileId) || null;
    lsSet(DEMO_USER_KEY, profileId);
  };

  Store.signOut = async function () {
    if (this.mode === 'supabase') await this.sb.auth.signOut();
    else lsDel(DEMO_USER_KEY);
    this.user = null;
  };

  Store.resetPassword = async function (email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
    if (error) throw new Error(error.message);
  };

  Store.setPassword = async function (password) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw new Error(error.message);
    this.needPassword = false;
  };

  // ---------------------------------------------------------------- lecture
  Store.loadAll = async function () {
    if (this.mode === 'demo') {
      const v = demoVisible();
      TABLES.forEach((t) => { this.data[t] = v[t].map((r) => Object.assign({}, r)); });
      this.data.settings = Object.assign({}, demoDb.settings);
      return;
    }
    const results = await Promise.all(TABLES.map((t) => this.sb.from(t).select('*')));
    results.forEach((res, i) => {
      if (res.error) throw new Error(res.error.message);
      this.data[TABLES[i]] = res.data;
    });
    const { data: settings } = await this.sb.from('settings').select('*');
    this.data.settings = {};
    (settings || []).forEach((s) => { this.data.settings[s.key] = s.value; });
  };

  // ---------------------------------------------------------------- écriture
  Store.insert = async function (table, obj) {
    let row;
    if (this.mode === 'demo') {
      row = Object.assign({ id: newId(), created_at: new Date().toISOString() }, obj);
      demoDb[table].push(row);
      demoSave();
      row = Object.assign({}, row);
    } else {
      const { data, error } = await this.sb.from(table).insert(obj).select().single();
      if (error) throw new Error(error.message);
      row = data;
    }
    this.data[table].push(row);
    return row;
  };

  Store.update = async function (table, id, patch) {
    let row;
    if (this.mode === 'demo') {
      const target = demoDb[table].find((r) => r.id === id);
      Object.assign(target, patch);
      demoSave();
      row = Object.assign({}, target);
    } else {
      const { data, error } = await this.sb.from(table).update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      row = data;
    }
    const list = this.data[table];
    const i = list.findIndex((r) => r.id === id);
    if (i >= 0) list[i] = row; else list.push(row);
    return row;
  };

  Store.remove = async function (table, id) {
    if (this.mode === 'demo') {
      demoDb[table] = demoDb[table].filter((r) => r.id !== id);
      if (table === 'clients') {
        ['activities', 'quotes', 'appointments', 'payments'].forEach((t) => { demoDb[t] = demoDb[t].filter((r) => r.client_id !== id); });
      }
      demoSave();
    } else {
      const { error } = await this.sb.from(table).delete().eq('id', id);
      if (error) throw new Error(error.message);
    }
    this.data[table] = this.data[table].filter((r) => r.id !== id);
    if (table === 'clients') {
      ['activities', 'quotes', 'appointments', 'payments'].forEach((t) => { this.data[t] = this.data[t].filter((r) => r.client_id !== id); });
    }
  };

  Store.saveSetting = async function (key, value) {
    if (this.mode === 'demo') {
      demoDb.settings[key] = value;
      demoSave();
    } else {
      const { error } = await this.sb.from('settings').upsert({ key, value });
      if (error) throw new Error(error.message);
    }
    this.data.settings[key] = value;
  };

  // ---------------------------------------------------------------- paiements
  // Crée le lien de paiement par carte (Stripe Checkout) pour un paiement déjà enregistré.
  // En mode réel, c'est la fonction serveur « create-checkout » qui parle à Stripe (la clé secrète n'est jamais dans le navigateur).
  Store.createCardLink = async function (paymentId) {
    if (this.mode === 'demo') {
      const url = location.href.split('#')[0] + '#/demo-paiement/' + paymentId;
      return this.update('payments', paymentId, { checkout_url: url });
    }
    const { data, error } = await this.sb.functions.invoke('create-checkout', { body: { payment_id: paymentId } });
    if (error || !data || !data.url) {
      let msg = 'Impossible de créer le lien de paiement.';
      try { const body = await error.context.json(); if (body.error) msg += ' ' + body.error; } catch (e) {}
      throw new Error(msg);
    }
    return this.refresh('payments', paymentId);
  };

  // Relit une ligne depuis la base (utilisé pour savoir si le client a payé).
  Store.refresh = async function (table, id) {
    let row;
    if (this.mode === 'demo') {
      demoLoad(); // relit le stockage : le « client » a pu payer dans un autre onglet
      row = Object.assign({}, demoDb[table].find((r) => r.id === id));
    } else {
      const { data, error } = await this.sb.from(table).select('*').eq('id', id).single();
      if (error) throw new Error(error.message);
      row = data;
    }
    const list = this.data[table];
    const i = list.findIndex((r) => r.id === id);
    if (i >= 0) list[i] = row; else list.push(row);
    return row;
  };

  Store.resetDemo = function () {
    demoDb = seed();
    demoSave();
  };

  // ---------------------------------------------------------------- données d'exemple
  function seed() {
    const day = (offset, h, m) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      d.setHours(h || 9, m || 0, 0, 0);
      return d.toISOString();
    };
    const date = (offset) => day(offset).slice(0, 10);
    const A = 'u-admin', T = 'u-tech';
    const c = (id, o) => Object.assign({
      id, created_at: day(-30), created_by: A, type: 'particulier', company: '', email: '', country: 'FR',
      heating_type: 'Gaz', boiler_brand: '', emitter_type: 'Radiateurs', radiators_count: null,
      last_service_date: null, service_interval_months: 36, notes: '', assigned_to: null
    }, o);

    const clients = [
      c('c1', { name: 'Martine Dupuis', phone: '06 12 34 56 78', email: 'martine.dupuis@example.fr', address: '12 rue Sommeiller', postal_code: '74000', city: 'Annecy', source: 'Google / Fiche Google', status: 'nouveau', radiators_count: 9, notes: 'Radiateurs froids en bas, bruit de circulation.', created_at: day(-2) }),
      c('c2', { name: 'Julien Morel', phone: '06 98 76 54 32', address: '5 avenue de Genève', postal_code: '73100', city: 'Aix-les-Bains', source: 'Site internet', status: 'contacte', heating_type: 'Fioul', radiators_count: 12, created_at: day(-6) }),
      c('c3', { name: 'Copropriété Les Cèdres', type: 'syndic', company: 'Cabinet Foncia Chambéry', phone: '04 79 00 11 22', email: 'gestion@example.fr', address: '30 quai Charles Ravet', postal_code: '73000', city: 'Chambéry', source: 'Partenaire / plombier', status: 'devis', emitter_type: 'Mixte', notes: 'Chaufferie collective, 24 logements.', created_at: day(-15) }),
      c('c4', { name: 'Sophie Lambert', phone: '06 45 67 89 01', address: '8 chemin des Vignes', postal_code: '74200', city: 'Thonon-les-Bains', source: 'Bouche-à-oreille', status: 'devis', heating_type: 'Pompe à chaleur', emitter_type: 'Plancher chauffant', created_at: day(-12) }),
      c('c5', { name: 'Marc Favre', phone: '+41 79 123 45 67', address: 'Rue de Carouge 44', postal_code: '1205', city: 'Genève', country: 'CH', source: 'Recommandation client', status: 'client', radiators_count: 7, last_service_date: date(-20), created_at: day(-60) }),
      c('c6', { name: 'Hélène Roux', phone: '06 22 33 44 55', address: '17 rue Lesdiguières', postal_code: '38000', city: 'Grenoble', source: 'Google / Fiche Google', status: 'client', radiators_count: 10, boiler_brand: 'Saunier Duval', last_service_date: date(-1080), created_at: day(-1100) }),
      c('c7', { name: 'Pierre Girard', phone: '06 77 88 99 00', address: '3 place de l\'Hôtel de Ville', postal_code: '74100', city: 'Annemasse', source: 'Site internet', status: 'client', assigned_to: T, radiators_count: 8, created_at: day(-10) }),
      c('c8', { name: 'Nathalie Blanc', phone: '06 11 22 33 44', address: '21 rue de la République', postal_code: '73200', city: 'Albertville', source: 'Réseaux sociaux', status: 'perdu', created_at: day(-40) })
    ];

    const q = (id, client_id, reference, amount, sent, status) => ({ id, created_at: day(sent), client_id, reference, amount, sent_date: date(sent), status, notes: '' });
    const quotes = [
      q('q1', 'c3', 'D-2026-0142', 4850, -9, 'envoye'),
      q('q2', 'c4', 'D-2026-0151', 690, -3, 'envoye'),
      q('q3', 'c5', 'D-2026-0120', 520, -40, 'accepte'),
      q('q4', 'c7', 'D-2026-0148', 610, -8, 'accepte'),
      q('q5', 'c8', 'D-2026-0101', 580, -35, 'refuse')
    ];

    const a = (id, client_id, technician_id, type, start, duration_min, status, notes) =>
      ({ id, created_at: day(-5), client_id, technician_id, type, start_at: start, duration_min, status, notes: notes || '', report: '' });
    const appointments = [
      a('a1', 'c1', A, 'visite', day(0, 10, 0), 60, 'confirme', 'Diagnostic + prise de mesures.'),
      a('a2', 'c7', T, 'desembouage', day(0, 14, 0), 240, 'planifie', 'Prévoir 2 bidons de produit.'),
      a('a3', 'c2', A, 'visite', day(1, 9, 30), 60, 'planifie'),
      a('a4', 'c6', A, 'entretien', day(3, 8, 30), 180, 'planifie', 'Entretien tous les 3 ans.'),
      a('a5', 'c3', T, 'visite', day(4, 11, 0), 90, 'planifie', 'Rendez-vous avec le gardien.'),
      a('a6', 'c5', A, 'desembouage', day(-20, 8, 0), 300, 'termine')
    ];
    appointments[1].amount_due = 610;
    appointments[5].report = 'Désembouage complet, eau très chargée. Pose d\'un filtre magnétique.';

    const act = (client_id, user_id, type, content, offset) => ({ id: newId(), created_at: day(offset, 11, 0), client_id, user_id, type, content });
    const activities = [
      act('c1', A, 'appel', 'Appel entrant via la fiche Google. RDV visite fixé.', -2),
      act('c2', A, 'appel', 'Rappel du client, intéressé. Visite à planifier.', -5),
      act('c3', A, 'email', 'Devis D-2026-0142 envoyé au syndic.', -9),
      act('c4', A, 'visite', 'Visite faite, plancher chauffant 110 m². Devis envoyé.', -3),
      act('c5', A, 'note', 'Client très satisfait, a laissé un avis Google.', -18),
      act('c8', A, 'statut', 'Statut : Devis envoyé → Perdu (a choisi un concurrent).', -20)
    ];

    const payments = [
      { id: 'p1', created_at: day(-20, 13, 30), created_by: A, client_id: 'c5', appointment_id: 'a6', amount: 520, description: 'Désembouage — Marc Favre', method: 'carte', status: 'paye', paid_at: day(-20, 13, 32), reference: 'AD-P1', checkout_url: null, stripe_session_id: null },
      { id: 'p2', created_at: day(-8, 17, 0), created_by: A, client_id: 'c7', appointment_id: null, amount: 183, description: 'Acompte 30 % — Pierre Girard', method: 'virement', status: 'en_attente', paid_at: null, reference: 'AD-P2', checkout_url: null, stripe_session_id: null }
    ];

    return {
      profiles: [
        { id: A, full_name: 'Sébastien', role: 'admin', phone: '06 58 65 80 56', color: '#1c74c4', active: true },
        { id: T, full_name: 'Thomas (technicien démo)', role: 'technicien', phone: '06 00 00 00 00', color: '#f0752c', active: true }
      ],
      clients, quotes, appointments, activities, payments,
      settings: {}
    };
  }

  window.Store = Store;
})();
