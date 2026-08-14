import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase';
import { useData } from '@/contexts/DataContext';
import type { WorkOrder, TravelLog, Inspection, Equipment, WorkOrderLabor, PartsRequisition, PartsRequisitionItem, FuelLevel } from '@/types';
import { formatDate, WORK_ORDER_STATUS_LABELS, TRAVEL_STATUS_LABELS, INSPECTION_STATUS_LABELS, FUEL_LEVEL_LABELS, EQUIPMENT_STATUS_LABELS } from '@/lib/constants';

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

const BRAND_COLOR: [number, number, number] = [23, 107, 135]; // teal-700
const DARK_COLOR: [number, number, number] = [30, 41, 59];
const MUTED_COLOR: [number, number, number] = [100, 116, 139];
const LIGHT_BG: [number, number, number] = [241, 245, 249];
const BORDER_COLOR: [number, number, number] = [203, 213, 225];

function header(doc: jsPDF, title: string, subtitle: string, number: string) {
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, PAGE_W, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('EMS', MARGIN, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Equipment Management System', MARGIN, 19);
  doc.text('Heavy Machinery & Workshop', MARGIN, 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, PAGE_W - MARGIN, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(number, PAGE_W - MARGIN, 19, { align: 'right' });
  doc.text(subtitle, PAGE_W - MARGIN, 24, { align: 'right' });

  doc.setTextColor(...DARK_COLOR);
}

function footer(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(`Generated on ${new Date().toLocaleString('en-GB')}`, MARGIN, PAGE_H - 7);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' });
  }
}

function infoRow(doc: jsPDF, y: number, label: string, value: string, labelW = 40): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_COLOR);
  doc.text(label, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_COLOR);
  const lines = doc.splitTextToSize(value || '—', CONTENT_W - labelW);
  doc.text(lines, MARGIN + labelW, y);
  return y + Math.max(6, lines.length * 5);
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFillColor(...LIGHT_BG);
  doc.rect(MARGIN, y - 4, CONTENT_W, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_COLOR);
  doc.text(title, MARGIN + 2, y + 1.5);
  return y + 8;
}

function checkPageBreak(doc: jsPDF, y: number, needed = 20): number {
  if (y > PAGE_H - 30) {
    doc.addPage();
    return 25;
  }
  return y;
}

// ============ WORK ORDER PDF ============
export function generateWorkOrderPDF(
  wo: WorkOrder,
  equipment: Equipment | undefined,
  _laborEntries: WorkOrderLabor[],
  _items: PartsRequisitionItem[]
): jsPDF {
  const doc = new jsPDF();
  header(doc, 'Folha de Obra', 'Maintenance Work Order', wo.number);

  let y = 38;

  // Identification
  y = sectionTitle(doc, y, 'Identificação');
  y = infoRow(doc, y, 'N° OS:', wo.number);
  y = infoRow(doc, y, 'Equipamento:', equipment?.name || '—');
  y = infoRow(doc, y, 'Modelo:', equipment?.model || '—');
  y = infoRow(doc, y, 'N° Série/Chassi:', wo.serial_chassis || equipment?.serial_number || '—');
  y = infoRow(doc, y, 'Data de Entrada:', formatDate(wo.entry_date));
  y = infoRow(doc, y, 'Horímetro/KM:', wo.hour_km_actual || '—');
  y = infoRow(doc, y, 'Cliente/Projecto:', wo.client_project || '—');
  y = infoRow(doc, y, 'Técnico/Recepcionista:', wo.technician_receptionist || '—');
  y += 3;

  // Work Order Details
  y = checkPageBreak(doc, y, 25);
  y = sectionTitle(doc, y, 'Work Order Details');
  y = infoRow(doc, y, 'Type:', wo.type.replace(/_/g, ' '));
  y = infoRow(doc, y, 'Status:', WORK_ORDER_STATUS_LABELS[wo.status]);
  y = infoRow(doc, y, 'Priority:', wo.priority.toUpperCase());
  y = infoRow(doc, y, 'Description:', wo.description || '—', 35);
  y += 3;

  // Diagnosis lines
  if (wo.diagnosis_lines && wo.diagnosis_lines.length > 0) {
    y = checkPageBreak(doc, y, 25);
    y = sectionTitle(doc, y, 'Diagnóstico Técnico & Trabalhos Solicitados');
    doc.setFontSize(9);
    doc.setTextColor(...DARK_COLOR);
    wo.diagnosis_lines.forEach((line, idx) => {
      y = checkPageBreak(doc, y, 8);
      if (line.text) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...MUTED_COLOR);
        doc.text(`${idx + 1}.`, MARGIN, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DARK_COLOR);
        const lines = doc.splitTextToSize(line.text, CONTENT_W - 8);
        doc.text(lines, MARGIN + 8, y);
        y += Math.max(5, lines.length * 4.5) + 1;
      }
    });
    y += 3;
  }

  // Entry Checklist
  if (wo.entry_checklist && wo.entry_checklist.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = sectionTitle(doc, y, 'Checklist de Entrada');
    doc.setFontSize(8);
    wo.entry_checklist.forEach((item) => {
      y = checkPageBreak(doc, y, 7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(item.checked ? 22 : 220, item.checked ? 163 : 38, item.checked ? 74 : 38);
      doc.text(item.checked ? 'YES' : 'NO', MARGIN, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK_COLOR);
      doc.text(item.label, MARGIN + 12, y);
      y += 5.5;
    });
    y += 3;
  }

  // Fuel level
  y = checkPageBreak(doc, y, 12);
  y = infoRow(doc, y, 'Nível Combustível:', wo.work_performed || '—', 50);
  y += 3;

  // Parts replaced
  if (wo.parts_replaced && wo.parts_replaced.length > 0) {
    y = checkPageBreak(doc, y, 25);
    y = sectionTitle(doc, y, 'Peças Necessárias / Substituídas');
    doc.setFillColor(...LIGHT_BG);
    doc.rect(MARGIN, y - 4, CONTENT_W, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...DARK_COLOR);
    doc.text('Referência', MARGIN + 2, y + 0.5);
    doc.text('Descrição da Peça', MARGIN + 50, y + 0.5);
    doc.text('Qtd', MARGIN + 165, y + 0.5);
    y += 6;
    doc.setFont('helvetica', 'normal');
    wo.parts_replaced.forEach((part) => {
      y = checkPageBreak(doc, y, 8);
      doc.text(part.reference || '—', MARGIN + 2, y);
      const descLines = doc.splitTextToSize(part.description || '', 110);
      doc.text(descLines, MARGIN + 50, y);
      doc.text(String(part.quantity), MARGIN + 165, y);
      y += Math.max(5, descLines.length * 4) + 1;
    });
    y += 4;
  }

  // Exit observations
  if (wo.exit_observations) {
    y = checkPageBreak(doc, y, 20);
    y = sectionTitle(doc, y, 'Observações de Saída');
    y = infoRow(doc, y, 'Notes:', wo.exit_observations, 25);
    y += 3;
  }

  // Signatures
  y = checkPageBreak(doc, y, 35);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_COLOR);
  doc.text('Assinaturas:', MARGIN, y);
  y += 10;
  const sigW = (CONTENT_W - 10) / 3;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  const sigPositions = [
    { label: 'Mecânico/Técnico', value: wo.mechanic_sign, x: MARGIN },
    { label: 'Engenheiro', value: wo.engineer_sign, x: MARGIN + sigW + 5 },
    { label: 'Cliente', value: wo.client_sign, x: MARGIN + (sigW + 5) * 2 },
  ];
  sigPositions.forEach((sig) => {
    doc.line(sig.x, y, sig.x + sigW - 5, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(sig.label, sig.x, y + 5);
    if (sig.value) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...DARK_COLOR);
      doc.text(sig.value, sig.x + 2, y - 1);
    }
  });

  footer(doc);
  return doc;
}

// ============ TRAVEL LOG PDF ============
export function generateTravelLogPDF(tl: TravelLog, vehicle: Equipment | undefined): jsPDF {
  const doc = new jsPDF();
  header(doc, 'Guia de Viagem', 'Travel & Vehicle Log', tl.number);

  let y = 38;

  // Identification
  y = sectionTitle(doc, y, 'Identificação');
  y = infoRow(doc, y, 'Motorista/Driver:', tl.driver_name || '—');
  y = infoRow(doc, y, 'Matrícula/Plate:', tl.license_plate || vehicle?.plate_number || '—');
  y = infoRow(doc, y, 'Viatura/Vehicle:', tl.vehicle_name || vehicle?.name || '—');
  y = infoRow(doc, y, 'Destino:', tl.destination || '—');
  y = infoRow(doc, y, 'Objetivo:', tl.purpose || '—', 35);
  y += 3;

  // Controlo de Saída & Retorno
  y = checkPageBreak(doc, y, 30);
  y = sectionTitle(doc, y, 'Controlo de Saída & Retorno');

  // Two-column layout for dates/times
  const colW = CONTENT_W / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_COLOR);
  doc.text('Data de Saída:', leftX, y);
  doc.text('Hora Prevista:', rightX, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...DARK_COLOR);
  doc.text(formatDate(tl.departure_date), leftX + 35, y);
  doc.text(tl.expected_return_time || '—', rightX + 32, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_COLOR);
  doc.text('Quilometragem Inicial:', leftX, y);
  doc.text('Data de Chegada:', rightX, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...DARK_COLOR);
  doc.text(`${tl.start_km} km`, leftX + 45, y);
  doc.text(formatDate(tl.arrival_date), rightX + 32, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_COLOR);
  doc.text('Hora de Chegada:', leftX, y);
  doc.text('Quilometragem Final:', rightX, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...DARK_COLOR);
  doc.text(tl.arrival_time || '—', leftX + 35, y);
  doc.text(`${tl.end_km} km`, rightX + 38, y);
  const distance = (tl.end_km || 0) - (tl.start_km || 0);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_COLOR);
  doc.text('Distância:', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_COLOR);
  doc.text(`${distance > 0 ? distance : 0} km`, leftX + 22, y);
  y += 3;

  // Fuel levels
  y = checkPageBreak(doc, y, 15);
  y = sectionTitle(doc, y, 'Nível de Combustível');
  y = infoRow(doc, y, 'Fuel Start:', FUEL_LEVEL_LABELS[tl.fuel_start as FuelLevel] || '—');
  y = infoRow(doc, y, 'Fuel End:', FUEL_LEVEL_LABELS[tl.fuel_end as FuelLevel] || '—');
  y += 3;

  // Entry Checklist
  if (tl.checklist && tl.checklist.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = sectionTitle(doc, y, 'Checklist de Entrada');
    doc.setFontSize(8);
    tl.checklist.forEach((item) => {
      y = checkPageBreak(doc, y, 7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(item.checked ? 22 : 220, item.checked ? 163 : 38, item.checked ? 74 : 38);
      doc.text(item.checked ? 'YES' : 'NO', MARGIN, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK_COLOR);
      doc.text(item.label, MARGIN + 12, y);
      y += 5.5;
    });
    y += 3;
  }

  // Team & Notes
  y = checkPageBreak(doc, y, 20);
  y = sectionTitle(doc, y, 'Equipa & Notas');
  y = infoRow(doc, y, 'Equipe de Viagem:', tl.travel_team || '—');
  y = infoRow(doc, y, 'Mecânico/Técnico:', tl.mechanic || '—');
  y = infoRow(doc, y, 'Despacho/Dispatcher:', tl.dispatcher || '—');
  y += 3;

  // Status
  y = infoRow(doc, y, 'Status:', TRAVEL_STATUS_LABELS[tl.status as keyof typeof TRAVEL_STATUS_LABELS] || '—');
  y += 3;

  // Signatures
  y = checkPageBreak(doc, y, 30);
  y += 10;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 5, y, MARGIN + 80, y);
  doc.line(PAGE_W - MARGIN - 80, y, PAGE_W - MARGIN - 5, y);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_COLOR);
  doc.text('Driver Signature', MARGIN + 5, y + 5);
  doc.text('Authorized By', PAGE_W - MARGIN - 80, y + 5);

  footer(doc);
  return doc;
}

// ============ INSPECTION PDF ============
export function generateInspectionPDF(insp: Inspection, equipment: Equipment | undefined): jsPDF {
  const doc = new jsPDF();
  header(doc, 'Inspection Report', `Weekly Checklist - ${insp.type}`, `INS-${insp.inspection_date}`);

  let y = 38;

  y = sectionTitle(doc, y, 'Equipment Information');
  y = infoRow(doc, y, 'Equipment:', equipment?.name || '—');
  y = infoRow(doc, y, 'Serial Number:', equipment?.serial_number || '—');
  y = infoRow(doc, y, 'Location:', equipment?.location || '—');
  y = infoRow(doc, y, 'Status:', equipment ? EQUIPMENT_STATUS_LABELS[equipment.status] : '—');
  y += 3;

  y = sectionTitle(doc, y, 'Inspection Details');
  y = infoRow(doc, y, 'Date:', formatDate(insp.inspection_date));
  y = infoRow(doc, y, 'Type:', insp.type.replace(/_/g, ' '));
  y = infoRow(doc, y, 'Inspector:', insp.inspector_name || '—');
  y = infoRow(doc, y, 'Result:', INSPECTION_STATUS_LABELS[insp.status]);
  y += 3;

  // Checklist table
  y = sectionTitle(doc, y, 'Checklist Items');
  doc.setFillColor(...LIGHT_BG);
  doc.rect(MARGIN, y - 4, CONTENT_W, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...DARK_COLOR);
  doc.text('Item', MARGIN + 2, y + 0.5);
  doc.text('OK', MARGIN + 140, y + 0.5);
  doc.text('Notes', MARGIN + 155, y + 0.5);
  y += 6;
  doc.setFont('helvetica', 'normal');

  insp.checklist.forEach((item) => {
    y = checkPageBreak(doc, y, 10);
    doc.setTextColor(...DARK_COLOR);
    const labelLines = doc.splitTextToSize(item.label, 130);
    doc.text(labelLines, MARGIN + 2, y);
    doc.setTextColor(item.checked ? 22 : 220, item.checked ? 163 : 38, item.checked ? 74 : 38);
    doc.setFont('helvetica', 'bold');
    doc.text(item.checked ? 'YES' : 'NO', MARGIN + 140, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_COLOR);
    const noteLines = doc.splitTextToSize(item.note || '', 45);
    doc.text(noteLines, MARGIN + 155, y);
    y += Math.max(5, labelLines.length * 4, noteLines.length * 4) + 1;
  });

  y += 5;
  y = checkPageBreak(doc, y, 20);
  y = sectionTitle(doc, y, 'General Notes');
  y = infoRow(doc, y, 'Notes:', insp.notes || '—', 25);
  y += 5;

  if (insp.signature) {
    y = checkPageBreak(doc, y, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_COLOR);
    doc.text('Digital Sign-off:', MARGIN, y);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...DARK_COLOR);
    doc.text(insp.signature, MARGIN + 35, y);
    y += 8;
  }

  y = checkPageBreak(doc, y, 25);
  y += 10;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 5, y, MARGIN + 80, y);
  doc.line(PAGE_W - MARGIN - 80, y, PAGE_W - MARGIN - 5, y);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_COLOR);
  doc.text('Inspector Signature', MARGIN + 5, y + 5);
  doc.text('Supervisor Approval', PAGE_W - MARGIN - 80, y + 5);

  footer(doc);
  return doc;
}

// ============ REQUISITION PDF ============
export function generateRequisitionPDF(
  req: PartsRequisition,
  items: PartsRequisitionItem[]
): jsPDF {
  const doc = new jsPDF();
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN_R = 12;
  const MARGIN_L = 12;
  const CONTENT_W_R = PAGE_W - MARGIN_L - MARGIN_R;

  // ---- Header band ----
  doc.setFillColor(15, 30, 50);
  doc.rect(0, 0, PAGE_W, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CHINANGOL, LDA', MARGIN_L, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('SANY DEPARTMENT', MARGIN_L, 18);

  // Number box (right)
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.rect(PAGE_W - MARGIN_R - 50, 6, 50, 14, 'S');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Nº', PAGE_W - MARGIN_R - 47, 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(req.number || 'TT-2026-______', PAGE_W - MARGIN_R - 38, 14);

  // Title bar
  doc.setFillColor(199, 89, 48);
  doc.rect(0, 32, PAGE_W, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PARTS & SERVICE REQUEST FORM', PAGE_W / 2, 39, { align: 'center' });

  let y = 52;

  // ---- Top field grid (two columns) ----
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const colL = MARGIN_L;
  const colR = PAGE_W / 2 + 2;
  const fieldRow = (label: string, val: string, x: number, yy: number, w: number) => {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(x, yy + 2, x + w, yy + 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, x, yy - 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(val || '—', x, yy, { maxWidth: w });
  };

  const lineH = 14;

  // Row 1
  fieldRow('CLIENT', req.client || '', colL, y, PAGE_W / 2 - MARGIN_L - 4);
  fieldRow('MODEL', req.model || '', colR, y, PAGE_W / 2 - MARGIN_R - 4);
  y += lineH;

  // Row 2
  fieldRow('DATE', formatDate(req.created_at), colL, y, PAGE_W / 2 - MARGIN_L - 4);
  fieldRow('O SUPERVISOR', req.supervisor_name || '', colR, y, PAGE_W / 2 - MARGIN_R - 4);
  y += lineH;

  // Row 3
  fieldRow('SERV. Nº', req.service_number || '', colL, y, PAGE_W / 2 - MARGIN_L - 4);
  fieldRow('SERIAL Nº', req.serial_number || '', colR, y, PAGE_W / 2 - MARGIN_R - 4);
  y += lineH;

  // Row 4
  fieldRow('REQUESTED BY', req.requested_by || '', colL, y, PAGE_W / 2 - MARGIN_L - 4);
  fieldRow('SIGN', req.supervisor_sign || '', colR, y, PAGE_W / 2 - MARGIN_R - 4);
  y += lineH;

  // Row 5
  fieldRow('HOUR/KM METER', req.hour_km_meter || '', colL, y, PAGE_W / 2 - MARGIN_L - 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('URGENCY:', colR, y - 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(req.urgency ? 220 : 100, req.urgency ? 38 : 116, req.urgency ? 38 : 139);
  doc.setFont('helvetica', 'bold');
  doc.text(req.urgency ? 'YES' : 'NO', colR + 22, y);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.rect(colR + 32, y - 4, 4, 4, 'S');
  if (req.urgency) {
    doc.setFillColor(220, 38, 38);
    doc.rect(colR + 32.5, y - 3.5, 3, 3, 'F');
  }
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('(yes/no)', colR + 38, y);
  y += lineH;

  // ---- Items table header ----
  y += 4;
  doc.setFillColor(15, 30, 50);
  doc.rect(MARGIN_L, y, CONTENT_W_R, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ITEM Nº', MARGIN_L + 2, y + 5.5);
  doc.text('QUANT.', MARGIN_L + 25, y + 5.5);
  doc.text('PARTS ID', MARGIN_L + 50, y + 5.5);
  doc.text('DESCRIPTION', MARGIN_L + 100, y + 5.5);
  y += 8;

  const colItemNo = MARGIN_L + 2;
  const colQuant = MARGIN_L + 25;
  const colPartsId = MARGIN_L + 50;
  const colDesc = MARGIN_L + 100;
  const rowH = 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  const maxRows = 25;
  for (let i = 0; i < maxRows; i++) {
    const item = items[i];
    const rowY = y + i * rowH;

    if (rowY > PAGE_H - 40) {
      doc.addPage();
      y = 20;
      doc.setFillColor(15, 30, 50);
      doc.rect(MARGIN_L, y, CONTENT_W_R, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('ITEM Nº', colItemNo, y + 5.5);
      doc.text('QUANT.', colQuant, y + 5.5);
      doc.text('PARTS ID', colPartsId, y + 5.5);
      doc.text('DESCRIPTION', colDesc, y + 5.5);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      continue;
    }

    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN_L, rowY, CONTENT_W_R, rowH, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_L, rowY + rowH, MARGIN_L + CONTENT_W_R, rowY + rowH);
    doc.line(MARGIN_L + 22, rowY, MARGIN_L + 22, rowY + rowH);
    doc.line(MARGIN_L + 45, rowY, MARGIN_L + 45, rowY + rowH);
    doc.line(MARGIN_L + 95, rowY, MARGIN_L + 95, rowY + rowH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(String(i + 1), colItemNo + 2, rowY + 5);

    if (item) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(String(item.quantity || ''), colQuant + 1, rowY + 5);
      doc.text(item.part_number || '', colPartsId + 1, rowY + 5);
      const descLines = doc.splitTextToSize(item.description || '', CONTENT_W_R - 100 - 4);
      doc.text(descLines[0] || '', colDesc + 1, rowY + 5);
    }
  }

  y += maxRows * rowH + 6;

  // ---- Notes ----
  if (y < PAGE_H - 30 && req.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('NOTES:', MARGIN_L, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const noteLines = doc.splitTextToSize(req.notes || '', CONTENT_W_R - 20);
    doc.text(noteLines, MARGIN_L + 18, y);
    y += noteLines.length * 5 + 6;
  }

  // ---- Footer signature area ----
  y = Math.max(y, PAGE_H - 35);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_L + 5, y, MARGIN_L + 75, y);
  doc.line(PAGE_W - MARGIN_R - 75, y, PAGE_W - MARGIN_R - 5, y);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Requested By', MARGIN_L + 5, y + 4);
  doc.text('Supervisor Approval', PAGE_W - MARGIN_R - 75, y + 4);

  // page footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_L, PAGE_H - 8, PAGE_W - MARGIN_R, PAGE_H - 8);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`CHINANGOL, LDA — SANY Department | Generated ${new Date().toLocaleString('en-GB')}`, MARGIN_L, PAGE_H - 4);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN_R, PAGE_H - 4, { align: 'right' });
  }

  return doc;
}

// ============ STORAGE & DOWNLOAD HELPERS ============
export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function previewPDF(doc: jsPDF) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function uploadPDFToStorage(
  doc: jsPDF,
  filePath: string
): Promise<{ error: string | null; path: string | null }> {
  try {
    const blob = doc.output('blob');
    const { error } = await supabase.storage
      .from('ems-documents')
      .upload(filePath, blob, { contentType: 'application/pdf', upsert: true });
    if (error) return { error: error.message, path: null };
    return { error: null, path: filePath };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Upload failed', path: null };
  }
}

export async function getDocumentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('ems-documents').createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

// Hook to generate and optionally save PDFs
export function usePdfGenerator() {
  const { saveDocument } = useData();

  const generateAndSave = async (
    doc: jsPDF,
    type: 'work_order' | 'travel_log' | 'inspection' | 'requisition',
    recordId: string,
    number: string,
    title: string
  ): Promise<{ error: string | null }> => {
    const filePath = `${type}s/${number}.pdf`;
    const { error: uploadError } = await uploadPDFToStorage(doc, filePath);
    if (uploadError) {
      return { error: uploadError };
    }
    const blob = doc.output('blob');
    const { error: docError } = await saveDocument({
      type,
      record_id: recordId,
      number,
      title,
      file_path: filePath,
      file_size: blob.size,
    });
    if (docError) return { error: docError };
    return { error: null };
  };

  return { generateAndSave };
}
