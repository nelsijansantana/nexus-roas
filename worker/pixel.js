/*__CONFIG__*/
/*__NX_USER__*/
"use strict";
(() => {
  var l = typeof __CONFIG__ != "undefined" ? __CONFIG__ : {},
    D = "nx_user",
    S = typeof __NX_USER__ != "undefined" ? __NX_USER__ : "",
    T = "";
  try {
    T = localStorage.getItem(D) || "";
  } catch (t) {}
  function G(t) {
    let e = parseInt((t || "").split("-")[0], 10);
    return isNaN(e) ? 0 : e;
  }
  var $ = !!S && G(S) > G(T),
    m = $ ? S : T || S;
  try {
    ($ || !T) && localStorage.setItem(D, m);
  } catch (t) {}
  var F = l.collect_url || "/collect/event",
    b = l.meta_test_event_code || "",
    K = l.tiktok_test_event_code || "",
    B = l.debug === !0;
  var r = {
    uuid() {
      return typeof crypto != "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (t) => {
            let e = (Math.random() * 16) | 0;
            return (t === "x" ? e : (e & 3) | 8).toString(16);
          });
    },
    sanitize(t) {
      if (!(t == null || t === "null" || t === "undefined")) return t;
    },
    getCookie(t) {
      let e = document.cookie.split(";");
      for (let n = 0; n < e.length; n++) {
        let i = e[n].trim().split("=");
        if (i[0] === t) return decodeURIComponent(i[1] || "");
      }
    },
    setCookie(t, e, n) {
      e &&
        (document.cookie = `${t}=${encodeURIComponent(e)}; max-age=${n}; path=/; SameSite=Lax; Secure`);
    },
    log(...t) {
      B && typeof console != "undefined" && console.debug("[NexusPixel]", ...t);
    },
  };
  var X = "nx_geo_v1",
    J = "nx_geo",
    ut = 365 * 24 * 60 * 60,
    ft = 720 * 60 * 60 * 1e3,
    W = [
      { url: "https://ipapi.co/json/", type: "json" },
      { url: "https://ipinfo.io/json", type: "json" },
      { url: "https://ipwhois.app/json/", type: "json" },
      { url: "https://www.cloudflare.com/cdn-cgi/trace", type: "text" },
    ];
  function w(t, e) {
    e &&
      (document.cookie = `${t}=${encodeURIComponent(e)}; max-age=${ut}; path=/; SameSite=Lax; Secure`);
  }
  function E(t) {
    return !t || typeof t != "string" ? null : t.toLowerCase().trim();
  }
  function _t(t) {
    let e = {};
    return (
      t
        .split(
          `
`,
        )
        .forEach((n) => {
          let i = n.split("=");
          i.length === 2 && (e[i[0]] = i[1]);
        }),
      { ip: e.ip || null, country: e.loc ? e.loc.toLowerCase() : null }
    );
  }
  function mt(t) {
    return Promise.race([
      fetch(t.url).then((e) => {
        if (!e.ok) throw new Error("bad");
        return t.type === "text" ? e.text() : e.json();
      }),
      new Promise((e, n) => setTimeout(() => n("timeout"), 2500)),
    ]);
  }
  var c = {
    _data: {
      ip: null,
      city: null,
      region: null,
      country: null,
      postal: null,
      currency: null,
    },
    _resolved: !1,
    _saveToCache() {
      try {
        localStorage.setItem(X, JSON.stringify({ ts: Date.now(), d: c._data }));
      } catch (t) {}
      (w("nx_ip", c._data.ip),
        w("nx_ct", c._data.city),
        w("nx_st", c._data.region),
        w("nx_co", c._data.country),
        w("nx_zp", c._data.postal),
        w("nx_cur", c._data.currency),
        w(J, JSON.stringify(c._data)));
    },
    _loadFromLS() {
      try {
        let t = localStorage.getItem(X);
        if (!t) return null;
        let e = JSON.parse(t);
        return !(e != null && e.d) ||
          !(e != null && e.ts) ||
          Date.now() - e.ts > ft
          ? null
          : e.d;
      } catch (t) {
        return null;
      }
    },
    _loadFromCookies() {
      let t = r.getCookie(J);
      if (t)
        try {
          return JSON.parse(t);
        } catch (n) {}
      let e = r.getCookie("nx_ip");
      return e
        ? {
            ip: e,
            city: r.getCookie("nx_ct") || null,
            region: r.getCookie("nx_st") || null,
            country: r.getCookie("nx_co") || null,
            postal: r.getCookie("nx_zp") || null,
            currency: r.getCookie("nx_cur") || null,
          }
        : null;
    },
    _resolve(t) {
      if (t >= W.length) {
        ((c._resolved = !0), c._data.ip && c._saveToCache());
        return;
      }
      mt(W[t])
        .then((e) => {
          if (typeof e == "string") {
            let n = _t(e);
            (!c._data.ip && n.ip && (c._data.ip = n.ip),
              !c._data.country && n.country && (c._data.country = n.country));
          } else
            (!c._data.ip && e.ip && (c._data.ip = e.ip),
              !c._data.city && e.city && (c._data.city = E(e.city)),
              !c._data.region &&
                (e.region || e.region_name) &&
                (c._data.region = E(e.region || e.region_name)),
              !c._data.country &&
                (e.country_code || e.country) &&
                (c._data.country = E(e.country_code || e.country)),
              !c._data.postal &&
                (e.postal || e.zip) &&
                (c._data.postal = E(e.postal || e.zip)),
              !c._data.currency &&
                e.currency &&
                (c._data.currency = E(e.currency)));
          c._data.ip && c._data.country
            ? ((c._resolved = !0), c._saveToCache())
            : c._resolve(t + 1);
        })
        .catch(() => c._resolve(t + 1));
    },
    init() {
      var n;
      let t = (n = l) == null ? void 0 : n.geo;
      if (t != null && t.country) {
        ((c._data = {
          ip: t.ip || null,
          city: t.city ? t.city.toLowerCase() : null,
          region: t.region ? t.region.toLowerCase() : null,
          country: t.country ? t.country.toLowerCase() : null,
          postal: t.postal || null,
          currency: null,
        }),
          (c._resolved = !0),
          c._saveToCache());
        return;
      }
      let e = c._loadFromLS();
      if (e != null && e.ip) {
        ((c._data = e), (c._resolved = !0));
        return;
      }
      if (((e = c._loadFromCookies()), e != null && e.ip)) {
        ((c._data = e), (c._resolved = !0));
        return;
      }
      c._resolve(0);
    },
  };
  var H = "nx_utms",
    P = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "utm_id",
      "utm_platform",
      "utm_network",
      "placement",
      "creative_format",
      "ad_id",
      "adset_id",
      "campaign_id",
      "conversion_type",
      "xcod",
      "src",
      "sck",
      "cid",
      "fbclid",
      "gclid",
      "gbraid",
      "wbraid",
      "ttclid",
      "msclkid",
      "twclid",
    ],
    h = {
      collect() {
        try {
          let t = new URLSearchParams(window.location.search),
            e = this.get() || {},
            n = !1;
          (P.forEach((i) => {
            let o = t.get(i);
            o && ((e[i] = o), (n = !0));
          }),
            n && localStorage.setItem(H, JSON.stringify(e)));
        } catch (t) {}
      },
      get() {
        try {
          let t = localStorage.getItem(H);
          return t ? JSON.parse(t) : null;
        } catch (t) {
          return null;
        }
      },
    };
  var y = {
    collect() {
      let t = new URLSearchParams(window.location.search),
        e = t.get("fbclid"),
        n = r.getCookie("_fbc");
      return (
        e && !n && (n = `fb.1.${Date.now()}.${e}`),
        {
          fbclid: e || void 0,
          fbc: n || r.getCookie("_fbc") || void 0,
          fbp: r.getCookie("_fbp") || r.getCookie("fbp") || void 0,
          gclid: t.get("gclid") || void 0,
          gbraid: t.get("gbraid") || void 0,
          wbraid: t.get("wbraid") || void 0,
          ttclid: t.get("ttclid") || void 0,
          ttp: r.getCookie("_ttp") || r.getCookie("ttp") || void 0,
          msclkid: t.get("msclkid") || void 0,
          twclid: t.get("twclid") || void 0,
        }
      );
    },
  };
  var Y = "nx_ga4_cid",
    N = {
      initGtag(t) {
        if (!t || typeof window == "undefined") return;
        window.dataLayer = window.dataLayer || [];
        function e() {
          window.dataLayer.push(arguments);
        }
        ((window.gtag = window.gtag || e),
          window.gtag("js", new Date()),
          window.gtag("config", t, { send_page_view: !1 }));
        let n = document.createElement("script");
        ((n.async = !0),
          (n.src = `https://www.googletagmanager.com/gtag/js?id=${t}`),
          (n.onload = () => {
            (window.gtag("event", "page_view", {
              page_location: window.location.href,
              page_title: document.title,
              page_referrer: document.referrer,
            }),
              r.log("GA4 gtag page_view fired", t));
          }),
          document.head.appendChild(n));
      },
      getClientId() {
        let t = r.getCookie("_ga");
        if (t) {
          let e = t.split(".");
          if (e.length >= 4) return `${e[2]}.${e[3]}`;
        }
        try {
          let e = localStorage.getItem(Y);
          if (e) return e;
          let n = `${Math.random().toString(36).substring(2)}.${Date.now()}`;
          return (localStorage.setItem(Y, n), n);
        } catch (e) {
          return "";
        }
      },
      getSessionData() {
        let e = (l.ga4_measurement_id || "").replace("G-", ""),
          n = r.getCookie(`_ga_${e}`);
        if (n) {
          let i = n.split(".");
          if (i.length >= 4)
            return {
              session_id: i[2] || "",
              session_count: i[3] || "",
              timestamp: i[4] || "",
            };
        }
        return { session_id: "", session_count: "", timestamp: "" };
      },
    };
  var R = {
    sendEvent(t, e, n) {
      let i = y.collect(),
        o = c._data,
        a = h.get() || {},
        s = N.getSessionData(),
        d = {};
      P.forEach((p) => {
        a[p] && (d[p] = a[p]);
      });
      let _ = {
        event: t,
        event_id: e,
        nx_user: m,
        page_url: window.location.href.split("?")[0],
        page_title: document.title || void 0,
        page_referrer: document.referrer || void 0,
        user_data: {
          city: r.sanitize(o.city) || void 0,
          state: r.sanitize(o.region) || void 0,
          country: r.sanitize(o.country) || void 0,
          zip: r.sanitize(o.postal) || void 0,
        },
        browser_data: {
          fbclid: r.sanitize(i.fbclid) || void 0,
          fbc: r.sanitize(i.fbc) || void 0,
          fbp: r.sanitize(i.fbp) || void 0,
          ttclid: r.sanitize(i.ttclid) || void 0,
          ttp: r.sanitize(i.ttp) || void 0,
          gclid: r.sanitize(i.gclid) || void 0,
          gbraid: r.sanitize(i.gbraid) || void 0,
          wbraid: r.sanitize(i.wbraid) || void 0,
          msclkid: r.sanitize(i.msclkid) || void 0,
          twclid: r.sanitize(i.twclid) || void 0,
          ga_client_id: N.getClientId() || void 0,
          ga_session_id: s.session_id || void 0,
          ga_session_count: s.session_count || void 0,
          ga_timestamp: s.timestamp || void 0,
          cart_token:
            r.sanitize(r.getCookie("cart_token")) ||
            r.sanitize(r.getCookie("cart")) ||
            void 0,
        },
        utm_data: Object.keys(d).length ? d : void 0,
        custom_data: n || void 0,
        test_event_code: b || void 0,
        tiktok_test_event_code: K || void 0,
      };
      (_.utm_data || delete _.utm_data,
        r.log("sendEvent", t, e, _),
        fetch(F, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(_),
          keepalive: !0,
        }).catch(() => {}));
    },
  };
  var gt = [
      "PageView",
      "ViewContent",
      "Search",
      "AddToCart",
      "AddToWishlist",
      "InitiateCheckout",
      "AddPaymentInfo",
      "Purchase",
      "Lead",
      "CompleteRegistration",
      "Contact",
      "Subscribe",
    ],
    pt = {
      PageView: "PageView",
      ViewContent: "ViewContent",
      AddToCart: "AddToCart",
      InitiateCheckout: "InitiateCheckout",
      Lead: "Lead",
      CompleteRegistration: "CompleteRegistration",
      Subscribe: "Subscribe",
      AddToWishlist: "AddToWishlist",
      AddPaymentInfo: "AddPaymentInfo",
      Search: "Search",
      RemoveFromCart: "RemoveFromCart",
      ViewCategory: "ViewCategory",
      ViewCart: "ViewCart",
    },
    Z = {
      PageView: "Pageview",
      ViewContent: "ViewContent",
      AddToCart: "AddToCart",
      InitiateCheckout: "InitiateCheckout",
      Lead: "Subscribe",
      CompleteRegistration: "CompleteRegistration",
      Subscribe: "Subscribe",
      AddToWishlist: "AddToWishlist",
      AddPaymentInfo: "AddPaymentInfo",
      Search: "Search",
      RemoveFromCart: null,
      ViewCategory: "ViewContent",
      ViewCart: "InitiateCheckout",
    },
    f = {
      _metaInited: [],
      _tiktokInited: [],
      _ready: !1,
      _queue: [],
      init(t, e) {
        (t != null && t.length && f._initMeta(t),
          e != null && e.length && f._initTikTok(e),
          l.google_ads_conversion_id &&
            f._initGoogleAds(l.google_ads_conversion_id),
          (f._ready = !0));
        let n = f._queue;
        ((f._queue = []), n.forEach((i) => f._fireNow(i.type, i.id, i.data)));
      },
      fireEvent(t, e, n) {
        if (!f._ready) {
          f._queue.push({ type: t, id: e, data: n });
          return;
        }
        f._fireNow(t, e, n);
      },
      _initMeta(t) {
        (typeof window.fbq == "undefined" &&
          (function (e, n, i, o) {
            let a = (e.fbq = function () {
              a.callMethod
                ? a.callMethod.apply(a, arguments)
                : a.queue.push(arguments);
            });
            (e._fbq || (e._fbq = a),
              (a.push = a),
              (a.loaded = !0),
              (a.version = "2.0"),
              (a.queue = []));
            let s = n.createElement(i);
            ((s.async = !0), (s.src = o));
            let d = n.getElementsByTagName(i)[0];
            d.parentNode.insertBefore(s, d);
          })(
            window,
            document,
            "script",
            "https://connect.facebook.net/en_US/fbevents.js",
          ),
          t.forEach((e) => {
            if (f._metaInited.includes(e)) return;
            (f._metaInited.push(e), window.fbq("set", "autoConfig", !1, e));
            let n = c._data || {},
              i = {};
            (n.city && (i.ct = n.city.replace(/[^a-z]/g, "")),
              n.region &&
                (i.st = n.region.replace(/[^a-z0-9]/g, "").substring(0, 2)),
              n.postal && (i.zp = n.postal.replace(/[\s-]/g, "")),
              n.country &&
                (i.country = n.country.replace(/[^a-z]/g, "").substring(0, 2)),
              m && (i.external_id = m),
              r.log("fbq init advMatch:", JSON.stringify(i)),
              window.fbq("init", e, i));
          }));
      },
      _initTikTok(t) {
        (typeof window.ttq == "undefined" &&
          (function (e, n, i) {
            e.TiktokAnalyticsObject = i;
            let o = (e[i] = e[i] || []);
            ((o.methods = [
              "page",
              "track",
              "identify",
              "instances",
              "debug",
              "on",
              "off",
              "once",
              "ready",
              "alias",
              "group",
              "enableCookie",
              "disableCookie",
            ]),
              (o.setAndDefer = (a, s) => {
                a[s] = function () {
                  a.push([s].concat([].slice.call(arguments, 0)));
                };
              }),
              o.methods.forEach((a) => o.setAndDefer(o, a)),
              (o.load = (a, s) => {
                let d = "https://analytics.tiktok.com/i18n/pixel/events.js";
                ((o._i = o._i || {}),
                  (o._i[a] = []),
                  (o._i[a]._u = d),
                  (o._t = o._t || {}),
                  (o._t[a] = +new Date()),
                  (o._o = o._o || {}),
                  (o._o[a] = s || {}));
                let _ = n.createElement("script");
                ((_.type = "text/javascript"),
                  (_.async = !0),
                  (_.src = `${d}?sdkid=${a}&lib=${i}`));
                let p = n.getElementsByTagName("script")[0];
                p.parentNode.insertBefore(_, p);
              }));
          })(window, document, "ttq"),
          t.forEach((e) => {
            if (f._tiktokInited.includes(e)) return;
            f._tiktokInited.push(e);
            let n = {};
            (m && (n.external_id = m),
              Object.keys(n).length &&
                (r.log("ttq identify:", JSON.stringify(n)),
                window.ttq.identify(n)),
              window.ttq.load(e));
          }));
      },
      _initGoogleAds(t) {
        if (!window._nxGadsLoaded) {
          ((window._nxGadsLoaded = !0),
            (window.dataLayer = window.dataLayer || []),
            (window.gtag = function () {
              window.dataLayer.push(arguments);
            }),
            window.gtag("js", new Date()),
            window.gtag("config", t));
          let e = document.createElement("script");
          ((e.async = !0),
            (e.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(t)}`),
            document.head.appendChild(e),
            r.log("gtag init:", t));
        }
      },
      _fireNow(t, e, n) {
        let i = y.collect(),
          o = c._data.ip,
          a = pt[t] || null;
        if (
          l.google_ads_conversion_id &&
          l.google_ads_events &&
          typeof window.gtag == "function"
        ) {
          let s = l.google_ads_events[t];
          if (s) {
            let d = {
              send_to: `${l.google_ads_conversion_id}/${s}`,
              currency: (n == null ? void 0 : n.currency) || "BRL",
            };
            ((n == null ? void 0 : n.value) != null &&
              (d.value = parseFloat(n.value) || 0),
              n != null &&
                n.order_id &&
                (d.transaction_id = String(n.order_id)),
              r.log("gtag conversion:", t, d.send_to),
              window.gtag("event", "conversion", d));
          }
        }
        if (a && typeof window.fbq != "undefined" && f._metaInited.length) {
          let s = n ? Object.assign({}, n) : {};
          (i.fbc && (s.fbc = i.fbc),
            i.fbp && (s.fbp = i.fbp),
            o && (s.client_ip_address = o),
            (s.client_user_agent = navigator.userAgent));
          let d = gt.includes(a) ? "track" : "trackCustom",
            _ = { eventID: e };
          (b && (_.testEventCode = b), window.fbq(d, a, s, _));
        }
        if (typeof window.ttq != "undefined" && f._tiktokInited.length) {
          let s = Z.hasOwnProperty(t) ? Z[t] : t;
          if (s !== null)
            if (s === "Pageview" || t === "PageView")
              window.ttq.page({}, { event_id: e });
            else {
              let d = n ? Object.assign({}, n) : {};
              (i.ttclid && (d.ttclid = i.ttclid),
                i.ttp && (d.ttp = i.ttp),
                o && (d.client_ip_address = o),
                (d.client_user_agent = navigator.userAgent),
                (d.content_type = d.content_type || "product"),
                window.ttq.track(s, d, { event_id: e }));
            }
        }
      },
    };
  var ht = [
      "cartpanda.com",
      "hotmart.com",
      "ticto.com.br",
      "ticto.io",
      "kiwify.com.br",
      "kiwify.com",
      "kirvano.com",
      "greenn.com.br",
      "pay.",
      "checkout.",
    ],
    wt = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "cid",
      "fbclid",
      "gclid",
      "gbraid",
      "wbraid",
      "ttclid",
      "msclkid",
      "twclid",
    ];
  function tt(t) {
    return t ? ht.some((e) => t.indexOf(e) > -1) : !1;
  }
  function et(t) {
    if (!t || t.tagName !== "A" || !t.href || !tt(t.hostname)) return;
    let e = h.get() || {},
      n;
    try {
      n = new URL(t.href);
    } catch (o) {
      return;
    }
    if (n.protocol !== "http:" && n.protocol !== "https:") return;
    let i = !1;
    (wt.forEach((o) => {
      e[o] && !n.searchParams.has(o) && (n.searchParams.set(o, e[o]), (i = !0));
    }),
      m &&
        (n.searchParams.has("src") || (n.searchParams.set("src", m), (i = !0)),
        n.searchParams.has("sck") || (n.searchParams.set("sck", m), (i = !0))),
      i && (t.href = n.toString()));
  }
  function nt(t) {
    let e = t.action || "";
    tt(e) &&
      m &&
      ["src", "sck"].forEach((n) => {
        if (!t.querySelector(`input[name="${n}"]`)) {
          let i = document.createElement("input");
          ((i.type = "hidden"), (i.name = n), (i.value = m), t.appendChild(i));
        }
      });
  }
  function Q() {
    let t = document.getElementsByTagName("A");
    for (let n = 0; n < t.length; n++) et(t[n]);
    let e = document.getElementsByTagName("FORM");
    for (let n = 0; n < e.length; n++) nt(e[n]);
  }
  var it = {
    init() {
      if (
        (document.addEventListener(
          "click",
          (t) => {
            let e = t.target;
            for (; e && e.tagName !== "A"; ) e = e.parentNode;
            e && e.href && et(e);
          },
          !0,
        ),
        document.addEventListener(
          "submit",
          (t) => {
            let e = t.target;
            e.tagName === "FORM" && nt(e);
          },
          !0,
        ),
        Q(),
        window.MutationObserver)
      ) {
        let t = new MutationObserver((n) => {
            n.forEach((i) => {
              i.addedNodes.length && Q();
            });
          }),
          e = () => t.observe(document.body, { childList: !0, subtree: !0 });
        document.body ? e() : document.addEventListener("DOMContentLoaded", e);
      }
    },
  };
  var L = {
    init() {
      let t = window.location.hostname.split("."),
        e = t[t.length - 2] || "",
        n = t.length >= 3 && e.length <= 3 ? 3 : 2,
        i =
          t.length >= 2
            ? "." + t.slice(-n).join(".")
            : window.location.hostname;
      ((document.cookie = `nx_lid=${encodeURIComponent(m)}; max-age=${365 * 24 * 60 * 60}; path=/; domain=${i}; SameSite=Lax; Secure`),
        window.Shopify &&
          (L._sync(), document.addEventListener("cart:updated", L._sync)));
    },
    _sync() {
      let t = h.get() || {},
        e = y.collect(),
        n = { nx_user: m };
      ([
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "utm_id",
        "utm_platform",
        "ad_id",
        "adset_id",
        "campaign_id",
        "src",
        "sck",
        "xcod",
      ].forEach((i) => {
        t[i] && (n[i] = t[i]);
      }),
        [
          "fbclid",
          "fbc",
          "fbp",
          "gclid",
          "gbraid",
          "wbraid",
          "ttclid",
          "ttp",
          "msclkid",
        ].forEach((i) => {
          e[i] && (n[i] = e[i]);
        }),
        fetch("/cart/update.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attributes: n }),
        }).catch(() => {}));
    },
  };
  var x = null;
  function k(t) {
    return t.customData && Object.keys(t.customData).length
      ? t.customData
      : void 0;
  }
  function yt(t, e) {
    if (!t || t === document || t.nodeType !== 1) return !1;
    let n = !0;
    if (e.selector)
      try {
        n = t.matches(e.selector);
      } catch (i) {
        n = !1;
      }
    return (
      n &&
        e.buttonText &&
        (n = (t.textContent || t.innerText || t.value || "")
          .trim()
          .toLowerCase()
          .includes(e.buttonText.toLowerCase())),
      n
    );
  }
  function xt(t) {
    document.addEventListener(
      "click",
      (e) => {
        let n = e.target;
        for (; n && n !== document.documentElement; ) {
          if (yt(n, t)) {
            x(t.eventName, k(t));
            return;
          }
          n = n.parentElement;
        }
      },
      !0,
    );
  }
  function Ct(t) {
    document.addEventListener(
      "submit",
      (e) => {
        let n = e.target,
          i = !0;
        if (t.selector)
          try {
            i = n.matches(t.selector);
          } catch (o) {
            i = !1;
          }
        i && x(t.eventName, k(t));
      },
      !0,
    );
  }
  function bt(t) {
    if (!t.scrollDepth) return;
    let e = !1,
      n = t.scrollDepth,
      i = () => {
        if (e) return;
        let o =
          document.documentElement.scrollHeight ||
          document.body.scrollHeight ||
          1;
        ((window.scrollY + window.innerHeight) / o) * 100 >= n &&
          ((e = !0),
          window.removeEventListener("scroll", i, !0),
          x(t.eventName, k(t)));
      };
    window.addEventListener("scroll", i, { passive: !0, capture: !0 });
  }
  function Et(t) {
    !t.timeSeconds ||
      t.timeSeconds <= 0 ||
      setTimeout(() => x(t.eventName, k(t)), t.timeSeconds * 1e3);
  }
  var ot = {
    init(t, e) {
      !(t != null && t.length) ||
        !e ||
        ((x = e),
        t.forEach((n) => {
          if (!(!(n != null && n.eventName) || !(n != null && n.triggerType)))
            switch (n.triggerType) {
              case "pageload":
                x(n.eventName, k(n));
                break;
              case "click":
                xt(n);
                break;
              case "form_submit":
                Ct(n);
                break;
              case "scroll":
                bt(n);
                break;
              case "time_on_page":
                Et(n);
                break;
            }
        }));
    },
  };
  var rt = {
      view_item: "ViewContent",
      select_item: "ViewContent",
      view_item_list: "ViewCategory",
      add_to_cart: "AddToCart",
      remove_from_cart: "RemoveFromCart",
      view_cart: "ViewCart",
      begin_checkout: "InitiateCheckout",
      add_shipping_info: "AddShippingInfo",
      add_payment_info: "AddPaymentInfo",
      search: "Search",
      add_to_wishlist: "AddToWishlist",
    },
    Nt = ["AddToCart", "InitiateCheckout", "AddPaymentInfo", "Purchase"],
    dt = null,
    ct = {};
  function at(t) {
    if (!t || typeof t != "object" || !t.event) return;
    let e = typeof t.event == "string" ? t.event.toLowerCase() : "";
    if (!e) return;
    let n = null;
    for (let u in rt)
      if (e === u || e.includes(u)) {
        n = rt[u];
        break;
      }
    if (!n) return;
    let i = t.ecommerce || {},
      o = t.eventModel || {},
      a = i.items || o.items || t.items || [],
      s =
        i.value !== void 0
          ? i.value
          : o.value !== void 0
            ? o.value
            : t.value !== void 0
              ? t.value
              : o.ecomm_totalvalue,
      d = i.currency || o.currency || t.currency || "BRL",
      _ = [],
      p = [],
      I = [],
      v = [],
      A = 0;
    a.forEach((u) => {
      let O = u.item_id || u.product_id || u.variant_id,
        q = u.item_name || u.product_title || u.name,
        j = parseInt(u.quantity, 10) || 1,
        z = parseFloat(u.price) || 0;
      if (O) {
        _.push(O.toString());
        let M = { id: O.toString(), quantity: j };
        (z && (M.item_price = z), p.push(M));
      }
      (q && I.push(q), (A += j));
      let U = u.item_category || u.category;
      U && !v.includes(U) && v.push(U);
    });
    let g = {};
    if (
      (_.length && (g.content_ids = _),
      p.length && (g.contents = p),
      _.length && (g.content_type = "product"),
      I.length && (g.content_name = I.join(", ")),
      v.length && (g.content_category = v.join(", ")),
      Nt.includes(n) &&
        (s !== void 0 && !isNaN(parseFloat(s)) && (g.value = parseFloat(s)),
        d && (g.currency = d)),
      A > 0 && (g.num_items = A),
      n === "Search")
    ) {
      let u = i.search_term || o.search_term || t.search_term;
      u && (g.search_string = u);
    }
    if (n === "ViewCategory") {
      let u =
        i.item_list_name ||
        o.item_list_name ||
        t.item_list_name ||
        i.item_list_id ||
        o.item_list_id ||
        t.item_list_id;
      (u && (g.content_category = u),
        _.length && (g.content_type = "product_group"));
    }
    let V = `${n}:${_.join(",")}`;
    ct[V] || ((ct[V] = !0), r.log("DataLayer \u2192", n, g), dt(n, g));
  }
  function st(t) {
    if (t) {
      if (t.length !== void 0 && t[0] === "event" && typeof t[1] == "string") {
        let e = t[2] || {},
          n = { event: t[1] };
        (e.items ? (n.ecommerce = e) : (n.eventModel = e),
          Object.assign(n, e),
          at(n));
        return;
      }
      at(t);
    }
  }
  var lt = {
    init(t) {
      if (!t) return;
      ((dt = t),
        (window.dataLayer = window.dataLayer || []),
        window.dataLayer.forEach((n) => {
          try {
            st(n);
          } catch (i) {}
        }));
      let e = window.dataLayer.push;
      ((window.dataLayer.push = function (...n) {
        let i = e.apply(this, n);
        return (
          n.forEach((o) => {
            try {
              st(o);
            } catch (a) {}
          }),
          i
        );
      }),
        r.log(
          "DataLayer observer inicializado, entradas existentes:",
          window.dataLayer.length,
        ));
    },
  };
  var C = {
    track(t, e, n) {
      let i = n || r.uuid();
      (R.sendEvent(t, i, e || void 0), f.fireEvent(t, i, e));
    },
    init() {
      var n, i;
      (c.init(),
        h.collect(),
        l.ga4_measurement_id && N.initGtag(l.ga4_measurement_id));
      let t = [],
        e = [];
      (l.meta_pixel_id && t.push(l.meta_pixel_id),
        (n = l.meta_pixel_ids_mirror) != null &&
          n.length &&
          l.meta_pixel_ids_mirror.forEach((o) => {
            t.includes(o) || t.push(o);
          }),
        l.tiktok_pixel_id && e.push(l.tiktok_pixel_id),
        f.init(t, e),
        C._sendPageView(),
        lt.init((o, a) => C.track(o, a)),
        it.init(),
        L.init(),
        (i = l.triggers) != null &&
          i.length &&
          ot.init(l.triggers, (o, a) => C.track(o, a)));
    },
    _sendPageView() {
      let t = r.uuid();
      (R.sendEvent("PageView", t, void 0), f.fireEvent("PageView", t));
    },
  };
  window.__NX_INITIALIZED__ ||
    ((window.__NX_INITIALIZED__ = !0),
    C.init(),
    (window.NexusPixel = { track: (t, e) => C.track(t, e), version: "3.1.0" }));
})();
