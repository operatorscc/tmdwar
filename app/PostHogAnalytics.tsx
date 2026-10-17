"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type PostHogClient = {
  capture?: (event: string, properties?: Record<string, string>) => void;
  __SV?: boolean;
};

declare global {
  interface Window {
    posthog?: PostHogClient;
    __tmdPostHogReady?: boolean;
    __tmdCapturePublicPage?: () => void;
  }
}

const SENSITIVE_PATH = /^\/(admin|auth|login|logout|signup|register|account|profile|checkout|payment|payments|finance|finence|api)(\/|$)/i;

function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATH.test(path);
}

export function PostHogAnalytics() {
  const pathname = usePathname();
  const lastCapturedPath = useRef<string | null>(null);
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const apiHost =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  useEffect(() => {
    if (!token) return;

    const captureCurrentPublicPage = () => {
      if (!window.__tmdPostHogReady) return;

      if (isSensitivePath(pathname)) {
        lastCapturedPath.current = null;
        return;
      }

      if (lastCapturedPath.current === pathname) return;
      lastCapturedPath.current = pathname;

      // Deliberately send only the pathname. Never send query strings, hashes,
      // account identifiers, bid data, payment details, or form contents.
      window.posthog?.capture?.("tmd_public_page_view", { path: pathname });
    };

    window.__tmdCapturePublicPage = captureCurrentPublicPage;
    captureCurrentPublicPage();

    return () => {
      if (window.__tmdCapturePublicPage === captureCurrentPublicPage) {
        delete window.__tmdCapturePublicPage;
      }
    };
  }, [pathname, token]);

  if (!token) return null;

  const tokenLiteral = JSON.stringify(token);
  const hostLiteral = JSON.stringify(apiHost);

  return (
    <Script id="tmd-posthog-init" strategy="afterInteractive">
      {`!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;void 0!==a?u=e[a]=[]:a="posthog";u.people=u.people||[];u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e};u.people.toString=function(){return u.toString(1)+".people (stub)"};n="init capture register register_once unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify alias setPersonProperties setPersonPropertiesForFlags reset group setPersonPropertiesForFlags get_distinct_id get_session_id get_session_replay_url startSessionRecording stopSessionRecording sessionRecordingStarted captureException".split(" ");for(o=0;o<n.length;o++)g(u,n[o]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);window.posthog.init(${tokenLiteral},{api_host:${hostLiteral},defaults:"2026-05-30",autocapture:false,capture_pageview:false,capture_pageleave:false,disable_session_recording:true,persistence:"memory",person_profiles:"identified_only",loaded:function(){window.__tmdPostHogReady=true;if(window.__tmdCapturePublicPage)window.__tmdCapturePublicPage();}});`}
    </Script>
  );
}
