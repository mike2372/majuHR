import { serve } from "https://deno.land/std@0.210.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { PDFDocument, rgb, StandardFonts } from "https://cdn.skypack.dev/pdf-lib";
import { encryptPDF } from "https://esm.sh/@pdfsmaller/pdf-encrypt-lite";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { payrollId, employeeId } = await req.json();

    // 1. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 2. Fetch Payroll and Employee Data
    const { data: pay, error: pError } = await supabaseAdmin
      .from('payroll')
      .select('*, employees(*)')
      .eq('id', payrollId)
      .single();

    if (pError || !pay) throw new Error("Payroll record not found.");
    const emp = pay.employees;

    // 3. Generate PDF content
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    const fontPrimary = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Header
    page.drawText('MajuHR Payslip', { x: 50, y: height - 50, size: 24, font: fontPrimary, color: rgb(0.12, 0.25, 0.68) });
    page.drawText(`Month: ${pay.month}`, { x: 50, y: height - 80, size: 12, font: fontRegular });

    // Employee Details
    page.drawText('Employee Details:', { x: 50, y: height - 120, size: 14, font: fontPrimary });
    page.drawText(`Name: ${emp.name}`, { x: 50, y: height - 140, size: 10, font: fontRegular });
    page.drawText(`IC No: ${emp.icNo || '-'}`, { x: 50, y: height - 155, size: 10, font: fontRegular });
    page.drawText(`ID: ${emp.id}`, { x: 50, y: height - 170, size: 10, font: fontRegular });

    // Financials
    page.drawText('Earnings:', { x: 50, y: height - 210, size: 14, font: fontPrimary });
    page.drawText(`Basic Salary: RM ${pay.basicSalary.toFixed(2)}`, { x: 50, y: height - 230, size: 10, font: fontRegular });
    page.drawText(`Allowances: RM ${pay.allowances.toFixed(2)}`, { x: 50, y: height - 245, size: 10, font: fontRegular });

    page.drawText('Deductions:', { x: 50, y: height - 280, size: 14, font: fontPrimary });
    page.drawText(`EPF (Employee): RM ${pay.epfEmployee.toFixed(2)}`, { x: 50, y: height - 300, size: 10, font: fontRegular });
    page.drawText(`SOCSO (Employee): RM ${pay.socsoEmployee.toFixed(2)}`, { x: 50, y: height - 315, size: 10, font: fontRegular });
    page.drawText(`EIS (Employee): RM ${pay.eisEmployee.toFixed(2)}`, { x: 50, y: height - 330, size: 10, font: fontRegular });
    page.drawText(`PCB (Income Tax): RM ${pay.pcb.toFixed(2)}`, { x: 50, y: height - 345, size: 10, font: fontRegular });

    page.drawLine({ start: { x: 50, y: height - 370 }, end: { x: 550, y: height - 370 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    
    page.drawText('NET SALARY:', { x: 400, y: height - 400, size: 16, font: fontPrimary, color: rgb(0.12, 0.25, 0.68) });
    page.drawText(`RM ${pay.netSalary.toLocaleString()}`, { x: 550, y: height - 400, size: 16, font: fontPrimary, color: rgb(0.12, 0.25, 0.68) });

    const pdfBytes = await pdfDoc.save();

    // 4. Encrypt PDF
    // Password: Last 4 of IC + Birth Year (YYYY)
    const last4NRIC = (emp.icNo || "0000").slice(-4);
    const birthYear = (emp.dob || "1900-01-01").split("-")[0];
    const password = `${last4NRIC}${birthYear}`;

    const encryptedPdfBytes = await encryptPDF(pdfBytes, password, password);

    // 5. Upload to Supabase Storage
    const fileName = `${emp.id}/${pay.month}_payslip.pdf`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('payslips')
      .upload(fileName, encryptedPdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 6. Generate Pre-signed URL (15 mins)
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from('payslips')
      .createSignedUrl(fileName, 900);

    if (urlError) throw urlError;

    return new Response(JSON.stringify({ url: urlData.signedUrl }), {
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
