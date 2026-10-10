// Real openFDA label records (trimmed to the fields the parser reads), captured 2026-10-10.
// Sources: reports/cold-chain-research/fda_label_*.json and the four-hour-rule brief (Hikma, Chartwell quotes).
import type { OpenFdaLabel } from '../src/index'

export const LABELS: Record<string, OpenFdaLabel> = {
  "lantus": {
    "set_id": "d5e07a0c-7e14-4756-9152-9fea485d654a",
    "effective_time": "20250602",
    "openfda": {
      "brand_name": [
        "Lantus Solostar"
      ],
      "generic_name": [
        "INSULIN GLARGINE"
      ],
      "manufacturer_name": [
        "sanofi-aventis U.S. LLC"
      ]
    },
    "storage_and_handling": [
      "16.2 Storage Dispense in the original sealed carton with the enclosed Instructions for Use. Store unused LANTUS in a refrigerator between 36°F and 46°F (2°C and 8°C). Do not freeze. Discard LANTUS if it has been frozen. Protect LANTUS from direct heat and light. Storage conditions are summarized in the following table. Not in-use (unopened) Not in-use (unopened) In-use (opened) Refrigerated Room Temperature (36°F–46°F [2°C–8°C]) (up to 86°F [30°C]) (see temperature below) 10 mL multiple-dose vial Until expiration date 28 days 28 days Refrigerated or room temperature 3 mL single-patient-use SoloStar prefilled pen Until expiration date 28 days 28 days Room temperature only (Do not refrigerate)"
    ],
    "how_supplied": [
      "16 HOW SUPPLIED/STORAGE AND HANDLING 16.1 How Supplied LANTUS (insulin glargine) injection is supplied as a clear and colorless solution containing 100 units/mL (U-100) available as follows: LANTUS NDC number Package size 10 mL Multiple-dose vial 0088-2220-33 1 vial per carton 3 mL SoloStar single-patient-use prefilled pen 0088-2219-05 5 pens per carton Additional Information about LANTUS Solostar: The LANTUS SoloStar prefilled pen dials in 1-unit increments. Needles are not included in the packs. Use BD Ultra-Fine ® needles ‡ with the SoloStar prefilled pens (these BD manufactured needles are sold separately). 16.2 Storage Dispense in the original sealed carton with the enclosed Instructions for Use. Store unused LANTUS in a refrigerator between 36°F and 46°F (2°C and 8°C). Do not freeze. Discard LANTUS if it has been frozen. Protect LANTUS from direct heat and light. Storage conditions are summarized in the following table. Not in-use (unopened) Not in-use (unopened) In-use (opened) Refrigerated Room Temperature (36°F–46°F [2°C–8°C]) (up to 86°F [30°C]) (see temperature below) 10 mL multiple-dose vial Until expiration date 28 days 28 days Refrigerated or room temperature 3 mL single-patient-use SoloStar prefilled pen Until expiration date 28 days 28 days Room temperature only (Do not refrigerate)"
    ]
  },
  "trulicity": {
    "set_id": "463050bd-2b1c-40f5-b3c3-0a04bb433309",
    "effective_time": "20260616",
    "openfda": {
      "brand_name": [
        "Trulicity"
      ],
      "generic_name": [
        "DULAGLUTIDE"
      ],
      "manufacturer_name": [
        "Eli Lilly and Company"
      ]
    },
    "storage_and_handling": [
      "16.2 Storage and Handling Store TRULICITY in the refrigerator at 36°F to 46°F (2°C to 8°C). If needed, each single-dose pen can be kept at room temperature, not to exceed 86°F (30°C) for a total of 14 days. Do not freeze TRULICITY. Do not use TRULICITY if it has been frozen. Protect TRULICITY from light. Storage of TRULICITY in the original carton is recommended until time of administration."
    ],
    "how_supplied": [
      "16 HOW SUPPLIED/STORAGE AND HANDLING 16.1 How Supplied TRULICITY (dulaglutide) injection is a clear and colorless solution supplied in single-dose pens. TRULICITY is packaged in a cardboard outer carton containing 4 single-dose TRULICITY pens and is supplied as follows: Total Strength per Total Volume NDC 0.75 mg/0.5 mL NDC 0002-1433-80 1.5 mg/0.5 mL NDC 0002-1434-80 3 mg/0.5 mL NDC 0002-2236-80 4.5 mg/0.5 mL NDC 0002-3182-80 16.2 Storage and Handling Store TRULICITY in the refrigerator at 36°F to 46°F (2°C to 8°C). If needed, each single-dose pen can be kept at room temperature, not to exceed 86°F (30°C) for a total of 14 days. Do not freeze TRULICITY. Do not use TRULICITY if it has been frozen. Protect TRULICITY from light. Storage of TRULICITY in the original carton is recommended until time of administration."
    ]
  },
  "humalog": {
    "set_id": "c8ecbd7a-0e22-4fc7-a503-faa58c1b6f3f",
    "effective_time": "20260616",
    "openfda": {
      "brand_name": [
        "Humalog"
      ],
      "generic_name": [
        "INSULIN LISPRO"
      ],
      "manufacturer_name": [
        "Eli Lilly and Company"
      ]
    },
    "storage_and_handling": [
      "16.2 Storage and Handling Dispense in the original sealed carton with the enclosed Instructions for Use. Protect from direct heat and light. Do not freeze and do not use if it has been frozen. See table below for storage information: * When stored at room temperature, HUMALOG U-100 and U-200 can only be used for a total of 28 days, including both not in-use (unopened) and in-use (opened) storage time. Not In-Use (Unopened) Room Temperature (Up to 86°F [30°C]) Not In-Use (Unopened) Refrigerated (36° to 46°F [2° to 8°C]) In-Use (Opened) (see temperature below) HUMALOG U-100* 10 mL multiple-dose vial 28 days Until expiration date 28 days Refrigerated or room temperature. 3 mL multiple-dose vial 28 days Until expiration date 28 days Refrigerated or room temperature. 3 mL single-patient-use cartridge 28 days Until expiration date 28 days Room temperature only (Do not refrigerate) 3 mL single-patient-use Humalog KwikPen 28 days Until expiration date 28 days Room temperature only (Do not refrigerate) 3 mL single-patient-use Humalog Tempo Pen 28 days Until expiration date 28 days Room temperature only (Do not refrigerate) 3 mL single-patient-use Humalog Junior KwikPen 28 days Until expiration date 28 days Room temperature only (Do not refrigerate) HUMALOG U-200* 3 mL single-patient-use Humalog KwikPen 28 days Until expiration date 28 days Room temperature only (Do not refrigerate) Use in an External Insulin Pump — Change the HUMALOG U-100 in the reservoir at least every 7 days, or according to the pump user manual, whichever is shorter, or after exposure to temperatures that exceed 98.6°F (37°C). Storage of Diluted HUMALOG U-100 for Subcutaneous Injection — Diluted HUMALOG for subcutaneous injection may be stored for 28 days when refrigerated at 41°F (5°C) and for 14 days at room temperature up to 86°F (30°C) [see Dosage and Administration ( 2.2 )]. Do not dilute HUMALOG contained in a cartridge or HUMALOG used in an external insulin pump. Storage of Intravenous Infusion Preparations with HUMALOG U-100 Intravenous infusion bags prepared with HUMALOG U-100 may be stored for 48 hours when refrigerated at 36° to 46°F (2° to 8°C). The prepared intravenous infusions bags may then be used at room temperature for up to an additional 48 hours [see Dosage and Administration ( 2.2 )] ."
    ],
    "how_supplied": [
      "16 HOW SUPPLIED/STORAGE AND HANDLING 16.1 How Supplied HUMALOG (insulin lispro) injection is a clear and colorless solution available as: a Tempo Pen contains a component that allows for data connectivity when used with a compatible transmitter. HUMALOG Total Volume Concentration NDC Number Package Size U-100 multiple-dose vial 10 mL 100 units/mL 0002-7510-01 1 vial U-100 multiple-dose vial 3 mL 100 units/mL 0002-7510-17 1 vial U-100 multiple-dose vial 3 mL 100 units/mL 0002-7533-01 1 vial U-100 single-patient-use cartridge 1 3 mL 100 units/mL 0002-7516-59 5 cartridges U-100 single-patient-use KwikPen 3 mL 100 units/mL 0002-8799-59 5 pens U-100 single-patient-use Tempo Pen a 3 mL 100 units/mL 0002-8213-05 5 pens U-100 single-patient-use Junior KwikPen 3 mL 100 units/mL 0002-7714-59 5 pens U-200 single-patient-use KwikPen 3 mL 200 units/mL 0002-7712-27 2 pens The U-100 KwikPen, U-100 Tempo Pen, and U-200 KwikPen dial in 1-unit increments. The U-100 Junior KwikPen dials in 0.5-unit increments. Each prefilled pen, cartridge, and reusable pen compatible with Lilly 3 mL cartridges is for single-patient-use only. HUMALOG prefilled pens, cartridges, and reusable pens compatible with Lilly 3 mL cartridges must never be shared between patients, even if the needle is changed. Patients using HUMALOG vials must never share needles or syringes with another person. 16.2 Storage and Handling Dispense in the original sealed carton with the enclosed Instructions for Use. Protect from direct heat and light. Do not freeze and do not use if it has been frozen. See table below for storage information: * When stored at room temperature, HUMALOG U-100 and U-200 can only be used for a total of 28 days, including both not in-use (unopened) and in-use (opened) storage time. Not In-Use (Unopened) Room Temperature (Up to 86°F [30°C]) Not In-Use (Unopened) Refrigerated (36° to 46°F [2° to 8°C]) In-Use (Opened) (see temperature below) HUMALOG U-100* 10 mL multiple-dose vial 28 days Until expiration date 28 days Refrigerated or room temperature. 3 mL multiple-dose vial 28 days Until expiration date 28 days Refrigerated or room temperature. 3 mL single-patient-use cartridge 28 days Until expiration date 28 days Room temperature only (Do not refrigerate) 3 mL single-patient-use Humalog KwikPen 28 days Until expiration date 28 days Room temperature only (Do not refrigerate) 3 mL single-patient-use Humalog Tempo Pen 28 days Until expiration date 28 days Room temperature only (Do not refrigerate) 3 mL single-patient-use Humalog Junior KwikPen 28 days Until expiration date 28 days Room temperature only (Do not refrigerate) HUMALOG U-200* 3 mL single-patient-use Humalog KwikPen 28 days Until expiration date 28 days Room temperature only (Do not refrigerate) Use in an External Insulin Pump — Change the HUMALOG U-100 in the reservoir at least every 7 days, or according to the pump user manual, whichever is shorter, or after exposure to temperatures that exceed 98.6°F (37°C). Storage of Diluted HUMALOG U-100 for Subcutaneous Injection — Diluted HUMALOG for subcutaneous injection may be stored for 28 days when refrigerated at 41°F (5°C) and for 14 days at room temperature up to 86°F (30°C) [see Dosage and Administration ( 2.2 )]. Do not dilute HUMALOG contained in a cartridge or HUMALOG used in an external insulin pump. Storage of Intravenous Infusion Preparations with HUMALOG U-100 Intravenous infusion bags prepared with HUMALOG U-100 may be stored for 48 hours when refrigerated at 36° to 46°F (2° to 8°C). The prepared intravenous infusions bags may then be used at room temperature for up to an additional 48 hours [see Dosage and Administration ( 2.2 )] ."
    ]
  },
  "humalogMix7525": {
    "set_id": "c73da51a-1899-45ad-b6cf-9c52c36a25dd",
    "effective_time": "20260616",
    "openfda": {
      "brand_name": [
        "Humalog Mix75/25"
      ],
      "generic_name": [
        "INSULIN LISPRO"
      ],
      "manufacturer_name": [
        "Eli Lilly and Company"
      ]
    },
    "storage_and_handling": [
      "16.2 Storage and Handling Dispense in the original sealed carton with the enclosed Instructions for Use. Protect from direct heat and light. Do not freeze and do not use if it has been frozen. See storage table below: a When stored at room temperature, HUMALOG Mix75/25 vial can only be used for a total of 28 days including both not in use (unopened) and in-use (opened) storage time. b When stored at room temperature, HUMALOG Mix75/25 KwikPen can only be used for a total of 10 days including both not in-use (unopened) and in-use (opened) storage time. Not In-Use (Unopened) Refrigerated (36° to 46°F [2° to 8°C]) Not In-Use (Unopened) Room Temperature (up to 86°F [30°C]) In-Use (Opened) (see temperature below) 10 mL multiple-dose vial a Until expiration date 28 days 28 days Refrigerated or room temperature 3 mL single-patient-use KwikPen b prefilled pen Until expiration date 10 days 10 days Room temperature only (Do not refrigerate)"
    ],
    "how_supplied": [
      "16 HOW SUPPLIED/STORAGE AND HANDLING 16.1 How Supplied HUMALOG Mix75/25 (insulin lispro protamine and insulin lispro) injectable suspension is a white and cloudy suspension of 100 units/mL (U-100) of 75% insulin lispro protamine and 25% insulin lispro available as: One 10 mL multiple-dose vial NDC 0002-7511-01 Five 3 mL single-patient-use KwikPen prefilled pen NDC 0002-8797-59 HUMALOG Mix75/25 KwikPen must never be shared between patients, even if the needle is changed. Patients using HUMALOG Mix75/25 vials must never share needles or syringes with another person. Always use a new disposable syringe or needle for each injection to prevent contamination. The HUMALOG Mix75/25 KwikPen dials in 1 unit increments. 16.2 Storage and Handling Dispense in the original sealed carton with the enclosed Instructions for Use. Protect from direct heat and light. Do not freeze and do not use if it has been frozen. See storage table below: a When stored at room temperature, HUMALOG Mix75/25 vial can only be used for a total of 28 days including both not in use (unopened) and in-use (opened) storage time. b When stored at room temperature, HUMALOG Mix75/25 KwikPen can only be used for a total of 10 days including both not in-use (unopened) and in-use (opened) storage time. Not In-Use (Unopened) Refrigerated (36° to 46°F [2° to 8°C]) Not In-Use (Unopened) Room Temperature (up to 86°F [30°C]) In-Use (Opened) (see temperature below) 10 mL multiple-dose vial a Until expiration date 28 days 28 days Refrigerated or room temperature 3 mL single-patient-use KwikPen b prefilled pen Until expiration date 10 days 10 days Room temperature only (Do not refrigerate)"
    ]
  },
  "humalogRepackager": {
    "set_id": "51d3dc11-52b9-4296-a2f4-58c770d4448d",
    "effective_time": "20240124",
    "openfda": {
      "brand_name": [
        "Humalog KwikPen"
      ],
      "generic_name": [
        "INSULIN LISPRO"
      ],
      "manufacturer_name": [
        "A-S Medication Solutions"
      ]
    },
    "how_supplied": [
      "16 HOW SUPPLIED/STORAGE AND HANDLING Product: 50090-4073 NDC: 50090-4073-0 3 mL in a SYRINGE / 5 in a CARTON"
    ]
  },
  "metformin": {
    "set_id": "0098dec4-f0e5-45d5-8aa4-5d0faf9ab142",
    "effective_time": "20260812",
    "openfda": {
      "brand_name": [
        "ZITUVIMET"
      ],
      "generic_name": [
        "SITAGLIPTIN AND METFORMIN HYDROCHLORIDE"
      ],
      "manufacturer_name": [
        "Zydus Lifesciences Limited"
      ]
    },
    "how_supplied": [
      "Store at 20°C to 25°C (68°F to 77°F), excursions permitted between 15°C and 30°C (59°F and 86°F), [see USP Controlled Room Temperature]. Protect from moisture."
    ]
  },
  "amoxicillinHikma": {
    "set_id": "077f4a65-3cfb-4cb1-99f2-e27ffc5939c0",
    "effective_time": "20240201",
    "openfda": {
      "brand_name": [
        "Amoxicillin"
      ],
      "manufacturer_name": [
        "Hikma Pharmaceuticals USA Inc."
      ]
    },
    "how_supplied": [
      "Amoxicillin for Oral Suspension USP, 250 mg/5mL ... Store dry powder at 20° to 25°C (68° to 77°F) [See USP Controlled Room Temperature]. Shake well before using. Refrigeration is preferable but not required. Discard suspension after 14 days. Keep container tightly closed."
    ]
  },
  "amoxClavChartwell": {
    "set_id": "00b86913-50c8-443f-8467-f4f499d358af",
    "effective_time": "20260723",
    "storageText": "Store reconstituted suspension under refrigeration. Discard unused suspension after 10 days.",
    "brand": "Amoxicillin and Clavulanate Potassium (Chartwell RX)"
  }
}
