import { serve } from "https://deno.land/std@0.210.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.210.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { payrollData, employeeData } = await req.json();

    // 1. Get Secrets
    const clientId = Deno.env.get("LHDN_CLIENT_ID");
    const clientSecret = Deno.env.get("LHDN_CLIENT_SECRET");
    const privateKeyPem = Deno.env.get("LHDN_PRIVATE_KEY"); // PKCS#8 PEM format

    if (!clientId || !clientSecret || !privateKeyPem) {
      throw new Error("Missing LHDN configuration in environment variables.");
    }

    // 2. Auth with LHDN
    // POST https://preprod-api.myinvois.hasil.gov.my/connect/token
    const authRes = await fetch("https://preprod-api.myinvois.hasil.gov.my/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "InvoicingAPI",
      }),
    });

    const { access_token } = await authRes.json();
    if (!access_token) throw new Error("Failed to authenticate with LHDN MyInvois.");

    // 3. Generate UBL 2.1 JSON Payload (DocType 11 - Self-Billed Invoice)
    const invoice = {
      "ID": `INV-${payrollData.id}`,
      "IssueDate": new Date().toISOString().split("T")[0],
      "IssueTime": new Date().toISOString().split("T")[1].split(".")[0] + "Z",
      "InvoiceTypeCode": { "value": "11", "listVersionID": "1.0" },
      "DocumentCurrencyCode": "MYR",
      "AccountingSupplierParty": {
        // Employer data (The one receiving the invoice in self-billed)
        "Party": {
          "PartyIdentification": [{ "ID": "EmployerTIN", "schemeID": "TIN" }],
          "PartyName": [{ "Name": "MajuHR Enterprise" }]
        }
      },
      "AccountingCustomerParty": {
        // Employee/Contractor data (The one issuing the invoice)
        "Party": {
          "PartyIdentification": [{ "ID": employeeData.taxNo, "schemeID": "TIN" }],
          "PartyName": [{ "Name": employeeData.name }]
        }
      },
      "InvoiceLine": [
        {
          "ID": "1",
          "InvoicedQuantity": { "unitCode": "UNIT", "value": 1 },
          "LineExtensionAmount": { "currencyID": "MYR", "value": payrollData.basicSalary },
          "Item": { "Description": "Monthly Salary/Commission" }
        }
      ],
      "LegalMonetaryTotal": {
        "LineExtensionAmount": { "currencyID": "MYR", "value": payrollData.basicSalary },
        "TaxExclusiveAmount": { "currencyID": "MYR", "value": payrollData.basicSalary },
        "TaxInclusiveAmount": { "currencyID": "MYR", "value": payrollData.basicSalary },
        "PayableAmount": { "currencyID": "MYR", "value": payrollData.netSalary }
      }
    };

    // 4. Digital Signature
    // a. Canonicalize (Minify)
    const canonicalJson = JSON.stringify(invoice);
    
    // b. Import Key
    const pemContents = privateKeyPem
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\s+/g, "");
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // c. Sign
    const signatureBuffer = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      new TextEncoder().encode(canonicalJson)
    );
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // 5. Wrap in Submission Format
    const submission = {
      documents: [
        {
          format: "JSON",
          documentHash: await computeHash(canonicalJson),
          document: btoa(canonicalJson), // LHDN expects base64 encoded doc
          // Note: In reality, the UBL structure needs to include the signature in UBLExtensions.
          // This is a simplified wrapper for demonstration.
        }
      ]
    };

    // 6. Submit to LHDN
    const submitRes = await fetch("https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submission),
    });

    const result = await submitRes.json();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function computeHash(data: string) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}
