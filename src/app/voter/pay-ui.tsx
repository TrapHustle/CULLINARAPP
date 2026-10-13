"use client";

import { useEffect, useRef, useState } from "react";
import { PHONE_COUNTRIES, type PaymentMethod, type PhoneCountry } from "@/lib/public-vote-core";
import styles from "./voter.module.css";

/**
 * Éléments de saisie partagés par la fenêtre de paiement et par la demande de
 * retrait de l'organisateur : logos des opérateurs et liste des pays.
 *
 * Ils vivent à part pour que les deux écrans aient le même rendu sans que le
 * panneau organisateur importe la page de vote — qui l'importe déjà, ce qui
 * formerait un cycle.
 */

export const LOGOS: Record<PaymentMethod, { src: string; className: string }[]> = {
  WAVE: [{ src: "/pay/wave.png", className: styles.logoWave }],
  ORANGE_MONEY: [{ src: "/pay/orange-money.svg", className: styles.logoOm }],
  MTN: [{ src: "/pay/mtn.svg", className: styles.logoMtn }],
  CARD: [
    { src: "/pay/visa.svg", className: styles.logoVisa },
    { src: "/pay/mastercard.svg", className: styles.logoMc },
  ],
};

/** Le logo MTN demande son fond jaune pour rester lisible. */
export const plateClass = (method: PaymentMethod) => (method === "MTN" ? styles.plateMtn : "");

/** Accents et casse ignorés : « senegal » trouve le Sénégal. */
function fold(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Liste des pays, posée par-dessus la fenêtre appelante.
 *
 * `countries` permet de restreindre le choix : un retrait ne peut partir que
 * vers un pays couvert par le mobile money, alors qu'un paiement par carte
 * accepte le monde entier.
 */
export function CountryPicker({
  selected,
  onPick,
  onBack,
  countries = PHONE_COUNTRIES,
}: {
  selected: PhoneCountry;
  onPick: (country: PhoneCountry) => void;
  onBack: () => void;
  countries?: PhoneCountry[];
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const needle = fold(query).trim();
  const digits = needle.replace(/\D/g, "");
  const found = countries.filter(
    (country) =>
      !needle || fold(country.name).includes(needle) || (digits !== "" && country.dial.startsWith(digits)),
  );

  return (
    <div className={styles.picker} role="dialog" aria-modal="true" aria-label="Choisir le pays du numéro">
      <div className={styles.pickerHead}>
        <button type="button" className={styles.x} onClick={onBack} aria-label="Revenir en arrière">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <input
          ref={searchRef}
          type="search"
          value={query}
          placeholder="Chercher un pays"
          aria-label="Chercher un pays"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (found[0]) onPick(found[0]);
          }}
        />
      </div>
      <div className={styles.pickerList} role="listbox" aria-label="Pays">
        {found.length === 0 ? (
          <p className={styles.pickerEmpty}>Aucun pays ne correspond.</p>
        ) : (
          found.map((country) => (
            <button
              key={country.code}
              type="button"
              role="option"
              aria-selected={country.code === selected.code}
              onClick={() => onPick(country)}
            >
              <span className={styles.pickerFlag} aria-hidden="true">
                {country.flag}
              </span>
              <span className={styles.pickerName}>{country.name}</span>
              <span className={`${styles.pickerDial} ${styles.num}`}>
                {country.dial ? `+${country.dial}` : "+…"}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
