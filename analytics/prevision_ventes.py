"""
PRÉVOIR LE CHIFFRE D'AFFAIRES ET LES RUPTURES — premier pas vers le Machine Learning (étape 8).

Entrées : les exports CSV de l'ERP (menu Analyses -> « Ventes par jour » et « Produits par jour »).
Sorties : prévisions au format de la table MySQL `forecasts` (ADR-008), prêtes à être importées.

Utilisation :
    pip install -r requirements.txt
    python prevision_ventes.py ventes_par_jour.csv produits_par_jour.csv

Démarche (la même que pour un « vrai » modèle de ML) :
    1. Explorer : moyenne par jour de la semaine (saisonnalité), tendance mensuelle.
    2. Découper dans le TEMPS : on apprend sur le passé, on évalue sur les 28 derniers jours.
       (Jamais de découpage aléatoire sur une série temporelle : ce serait « tricher » avec le futur.)
    3. Comparer des modèles SIMPLES (baselines) avec une métrique : le MAE et le WAPE.
       Un modèle complexe (Prophet, gradient boosting…) ne vaut que s'il bat ces baselines.
    4. Prévoir les 14 prochains jours avec le meilleur, et la date de rupture de chaque produit.
"""
import sys
from datetime import datetime, timezone

import pandas as pd

HORIZON = 14  # jours à prévoir
TEST_DAYS = 28  # jours réservés à l'évaluation
DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]


def load(path: str) -> pd.DataFrame:
    # utf-8-sig : retire le BOM ajouté pour Excel ; sep=";" : séparateur français
    return pd.read_csv(path, sep=";", encoding="utf-8-sig", parse_dates=["date"])


def mae(actual: pd.Series, predicted: pd.Series) -> float:
    """Erreur absolue moyenne, en F CFA : « en moyenne, on se trompe de X F par jour »."""
    return float((actual - predicted).abs().mean())


def wape(actual: pd.Series, predicted: pd.Series) -> float:
    """Erreur en % du total (préférée au MAPE, qui explose les jours à 0 vente)."""
    return float((actual - predicted).abs().sum() / actual.sum() * 100)


# ---- Les modèles : chacun reçoit l'historique et renvoie une prévision pour une liste de dates ----

def model_global_mean(history: pd.DataFrame, dates: pd.DatetimeIndex) -> pd.Series:
    return pd.Series(history["revenue"].mean(), index=dates)


def model_moving_average(history: pd.DataFrame, dates: pd.DatetimeIndex, window: int = 28) -> pd.Series:
    return pd.Series(history["revenue"].tail(window).mean(), index=dates)


def model_weekday_mean(history: pd.DataFrame, dates: pd.DatetimeIndex, weeks: int = 8) -> pd.Series:
    """Saisonnalité hebdomadaire : un samedi ressemble aux samedis récents."""
    recent = history.tail(weeks * 7)
    by_day = recent.groupby(recent.index.dayofweek)["revenue"].mean()
    return pd.Series([by_day.get(d.dayofweek, 0.0) for d in dates], index=dates)


def model_weekday_median(history: pd.DataFrame, dates: pd.DatetimeIndex, weeks: int = 8) -> pd.Series:
    """Même idée avec la MÉDIANE : insensible aux grosses commandes rares des revendeurs."""
    recent = history.tail(weeks * 7)
    by_day = recent.groupby(recent.index.dayofweek)["revenue"].median()
    return pd.Series([by_day.get(d.dayofweek, 0.0) for d in dates], index=dates)


MODELS = {
    "moyenne_globale": model_global_mean,
    "moyenne_mobile_28j": model_moving_average,
    "moyenne_par_jour_semaine_8sem": model_weekday_mean,
    "mediane_par_jour_semaine_8sem": model_weekday_median,
}


def main(daily_path: str, products_path: str) -> None:
    daily = load(daily_path).set_index("date").asfreq("D", fill_value=0)  # aucun jour manquant
    daily["revenue"] = daily["products_revenue"] + daily["services_revenue"]
    print(f"Historique : {len(daily)} jours, du {daily.index.min():%d/%m/%Y} au {daily.index.max():%d/%m/%Y}")
    print(f"CA total : {daily['revenue'].sum():,.0f} F CFA".replace(",", " "))

    # 1. EXPLORER
    print("\n1. Saisonnalité : CA moyen par jour de la semaine")
    by_day = daily.groupby(daily.index.dayofweek)["revenue"].mean()
    for d, v in by_day.items():
        print(f"   {DAYS[d]}  {v:>9,.0f} F  {'#' * int(v / by_day.max() * 30)}".replace(",", " "))
    print("\n   Tendance : CA par mois")
    for month, v in daily["revenue"].resample("MS").sum().items():
        print(f"   {month:%Y-%m}  {v:>11,.0f} F".replace(",", " "))

    # 2. DÉCOUPER dans le temps (le dernier jour, souvent incomplet, est exclu)
    data = daily.iloc[:-1]
    train, test = data.iloc[:-TEST_DAYS], data.iloc[-TEST_DAYS:]
    print(f"\n2. Apprentissage : {len(train)} jours · évaluation : {len(test)} derniers jours")

    # 3. COMPARER
    print("\n3. Erreur de chaque modèle sur la période d'évaluation (plus bas = meilleur)")
    scores = {}
    for name, model in MODELS.items():
        pred = model(train, test.index)
        scores[name] = (mae(test["revenue"], pred), wape(test["revenue"], pred))
        print(f"   {name:<32} MAE {scores[name][0]:>8,.0f} F/jour   WAPE {scores[name][1]:5.1f} %".replace(",", " "))
    best = min(scores, key=lambda n: scores[n][0])
    print(f"   -> retenu : {best}")

    # 4. PRÉVOIR avec tout l'historique, et une fourchette = ± l'erreur moyenne observée
    future = pd.date_range(data.index.max() + pd.Timedelta(days=1), periods=HORIZON, freq="D")
    forecast = MODELS[best](data, future)
    err = scores[best][0]
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    out = pd.DataFrame({
        "metric": "daily_revenue", "product_id": None, "target_date": future.date,
        "predicted_value": forecast.round(2).values, "lower_bound": (forecast - err).clip(lower=0).round(2).values,
        "upper_bound": (forecast + err).round(2).values, "model_name": best, "model_version": "1.0", "generated_at": now,
    })
    print(f"\n4. Prévision des {HORIZON} prochains jours : {forecast.sum():,.0f} F CFA (± {err:,.0f} F par jour)".replace(",", " "))

    # Bonus : date de rupture par produit = stock actuel ÷ demande moyenne des 8 dernières semaines
    products = load(products_path)
    last_day = products["date"].max()
    recent = products[products["date"] > last_day - pd.Timedelta(days=56)]
    demand = recent.groupby(["product_id", "product"])["quantity_sold"].mean()
    stock = products[products["date"] == last_day].set_index(["product_id", "product"])["stock_end"]
    print("\n   Rupture prévue (stock ÷ demande moyenne des 8 dernières semaines)")
    rows = []
    for (pid, name), per_day in demand.sort_values(ascending=False).items():
        days_left = stock[(pid, name)] / per_day if per_day > 0 else float("inf")
        when = "pas de vente récente" if days_left == float("inf") else f"dans {days_left:4.0f} j ({(last_day + pd.Timedelta(days=int(days_left))):%d/%m/%Y})"
        print(f"   {name:<28} stock {stock[(pid, name)]:>4}  demande {per_day:4.2f}/j  {when}")
        if days_left != float("inf"):
            rows.append({"metric": "days_of_cover", "product_id": pid, "target_date": last_day.date(), "predicted_value": round(days_left, 2),
                         "lower_bound": None, "upper_bound": None, "model_name": "stock_sur_demande_8sem", "model_version": "1.0", "generated_at": now})

    result = pd.concat([out, pd.DataFrame(rows)], ignore_index=True)
    result.to_csv("forecasts.csv", sep=";", index=False)
    print(f"\n{len(result)} prévisions écrites dans forecasts.csv (colonnes de la table `forecasts`).")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage : python prevision_ventes.py ventes_par_jour.csv produits_par_jour.csv")
    main(sys.argv[1], sys.argv[2])
