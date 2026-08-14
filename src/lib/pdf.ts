import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { useData } from '@/contexts/DataContext';
import type { WorkOrder, TravelLog, Inspection, Equipment, WorkOrderLabor, PartsRequisition, PartsRequisitionItem, FuelLevel } from '@/types';
import { formatDate, TRAVEL_STATUS_LABELS, INSPECTION_STATUS_LABELS, FUEL_LEVEL_LABELS, EQUIPMENT_STATUS_LABELS } from '@/lib/constants';

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

const BRAND_COLOR: [number, number, number] = [23, 107, 135];
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
    doc.text(`Gerado em ${new Date().toLocaleString('pt-PT')}`, MARGIN, PAGE_H - 7);
    doc.text(`Página ${i} de ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' });
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

// ============ WORK ORDER PDF (MODELO OFICIAL CHINANGOL / SANY) ============
export function generateWorkOrderPDF(
  wo: WorkOrder,
  equipment: Equipment | undefined,
  _laborEntries: WorkOrderLabor[] = [],
  requisitionItems: PartsRequisitionItem[] = []
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 10;
  const contentWidth = PAGE_W - margin * 2; // 190mm
  let y = 10;

  // --- CABEÇALHO SANY / CHINANGOL ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('CHINANGOL, LDA', margin, y + 4);

  doc.setFontSize(8.5);
  doc.setTextColor(218, 41, 28); // Vermelho SANY
  doc.text('SANY DEPARTMENT', margin, y + 8.5);

  // Título à direita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text('FOLHA DE OBRA / ORDEM DE', PAGE_W - margin, y + 3, { align: 'right' });
  doc.text('SERVIÇO', PAGE_W - margin, y + 7.5, { align: 'right' });

  // Caixa Vermelha com o Número da OS
  const boxWidth = 48;
  const boxHeight = 7.5;
  const boxX = PAGE_W - margin - boxWidth;
  const boxY = y + 9.5;

  doc.setDrawColor(218, 41, 28);
  doc.setLineWidth(0.8);
  doc.rect(boxX, boxY, boxWidth, boxHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(218, 41, 28);
  const woNumber = wo?.number || (wo as any)?.code || 'OS-2026-000';
  doc.text(`Nº ${woNumber}`, boxX + boxWidth / 2, boxY + 5, { align: 'center' });

  y += 20;

  // Auxiliar para barras de secção pretas com detalhe vermelho
  const drawSectionHeader = (title: string, currentY: number) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, currentY, contentWidth, 5, 'F');

    doc.setFillColor(218, 41, 28);
    doc.rect(margin, currentY, 1.8, 5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 3.5, currentY + 3.5);

    return currentY + 5;
  };

  // --- 1. IDENTIFICAÇÃO DO EQUIPAMENTO & CLIENTE ---
  y = drawSectionHeader('1. IDENTIFICAÇÃO DO EQUIPAMENTO & CLIENTE', y);

  const eqCode = (wo as any)?.equipment_name || equipment?.name || equipment?.code || '—';
  const eqModel = equipment?.model || (wo as any)?.model || '—';
  const serialNo = wo?.serial_chassis || equipment?.serial_number || (wo as any)?.serial_number || '—';
  const entryDate = formatDate(wo?.entry_date || (wo as any)?.created_at) || '—';
  const horometer = wo?.hour_km_actual ? `${wo.hour_km_actual}` : equipment?.horometer ? `${equipment.horometer} H` : '—';
  const clientProject = wo?.client_project || (wo as any)?.client || '—';
  const receptionist = wo?.technician_receptionist || (wo as any)?.technician || '—';

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      textColor: [0, 0, 0],
      lineColor: [160, 200, 230],
      lineWidth: 0.2,
      font: 'helvetica',
      minCellHeight: 6,
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.25, halign: 'center' },
      1: { cellWidth: contentWidth * 0.25, halign: 'center' },
      2: { cellWidth: contentWidth * 0.25, halign: 'center' },
      3: { cellWidth: contentWidth * 0.25, halign: 'center' },
    },
    body: [
      [
        { content: 'ID DO EQUIPAMENTO', fontStyle: 'bold' },
        { content: 'MODELO', fontStyle: 'bold' },
        { content: 'No DE SÉRIE / CHASSI', fontStyle: 'bold' },
        { content: 'DATA DE ENTRADA', fontStyle: 'bold' },
      ],
      [eqCode, eqModel, serialNo, entryDate],
      [
        { content: 'HORÍMETRO / KM ATUAL', fontStyle: 'bold' },
        { content: 'CLIENTE / PROJECTO', fontStyle: 'bold' },
        { content: 'TÉCNICO / RECEPCIONISTA', fontStyle: 'bold', colSpan: 2 },
      ],
      [horometer, clientProject, { content: receptionist, colSpan: 2 }],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 2.5;

  // --- 2. DIAGNÓSTICO TÉCNICO & TRABALHOS SOLICITADOS ---
  y = drawSectionHeader('2. DIAGNÓSTICO TÉCNICO & TRABALHOS SOLICITADOS', y);

  const diagHeight = 24;
  doc.setDrawColor(160, 200, 230);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, contentWidth, diagHeight);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);

  // Extrair o texto de diagnóstico (seja array ou descrição única)
  let rawDiagLines: string[] = [];
  if (Array.isArray((wo as any)?.diagnosis_lines)) {
    rawDiagLines = (wo as any).diagnosis_lines.map((l: any) => typeof l === 'string' ? l : l.text || '');
  } else if (wo?.description) {
    rawDiagLines = wo.description.split('\n');
  }

  for (let i = 0; i < 6; i++) {
    const lineText = rawDiagLines[i] || '';
    doc.text(`${i + 1} - ${lineText}`, margin + 2.5, y + 3.8 + i * 3.8);
  }

  y += diagHeight + 2.5;

  // --- 3. INSPECÇÃO E CHECKLIST DE ENTRADA ---
  y = drawSectionHeader('3. INSPECÇÃO E CHECKLIST DE ENTRADA', y);

  const checklistHeight = 22;
  doc.setDrawColor(160, 200, 230);
  doc.rect(margin, y, contentWidth, checklistHeight);

  const col1X = margin + 2.5;
  const col2X = margin + (contentWidth / 2) + 1;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');

  // Desenhar a checklist de entrada padrão
  doc.text('Nível de Óleo do Motor (OK / Repor)  o', col1X, y + 3.8);
  doc.text('Nível de Óleo Hidráulico (OK / Repor)  o', col1X, y + 7.6);
  doc.text('Líquido de Refrigeração (Radiador)  o', col1X, y + 11.4);
  doc.text('Filtros de Ar e Combustível (Estado)  □', col1X, y + 15.2);
  doc.text('Estado das Lagartas / Pneus e Aperto  ⊔', col1X, y + 19.0);

  doc.text('Sistema Elétrico, Luzes e Faróis  o', col2X, y + 3.8);
  doc.text('Vidros, Espelhos e Cabine do Operador  o', col2X, y + 7.6);
  doc.text('Dispositivos de Segurança / Extintor  o', col2X, y + 11.4);
  doc.text('Ferramentas e Acessórios de Bordo  □', col2X, y + 15.2);

  doc.setFont('helvetica', 'bold');
  doc.text('NÍVEL COMBUSTÍVEL: E  ⊔  1/4  ⊔  1/2  ⊔  3/4  ⊔  F  ⊔', col2X, y + 19.0);

  y += checklistHeight + 2.5;

  // --- 4. PEÇAS NECESSÁRIAS / SUBSTITUÍDAS (PART REQUEST) ---
  y = drawSectionHeader('4. PEÇAS NECESSÁRIAS / SUBSTITUÍDAS (PART REQUEST)', y);

  let partsData: string[][] = [];

  if (wo?.parts_replaced && Array.isArray(wo.parts_replaced) && wo.parts_replaced.length > 0) {
    partsData = wo.parts_replaced.map((p) => [p.reference || '', p.description || '', p.quantity?.toString() || '']);
  } else if (requisitionItems && requisitionItems.length > 0) {
    partsData = requisitionItems.map((item) => [item.part_number || '', item.description || '', item.quantity_requested?.toString() || '']);
  }

  while (partsData.length < 5) {
    partsData.push(['', '', '']);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      textColor: [0, 0, 0],
      lineColor: [160, 200, 230],
      lineWidth: 0.2,
      font: 'helvetica',
      minCellHeight: 5,
    },
    headStyles: {
      fillColor: [75, 165, 220],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 45, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 35, halign: 'center' },
    },
    head: [['REFERÊNCIA', 'DESCRIÇÃO DA PEÇA', 'QUANTIDADE']],
    body: partsData,
  });

  y = (doc as any).lastAutoTable.finalY + 2.5;

  // --- 5. OBSERVAÇÕES DE SAÍDA / NOTAS ADICIONAIS ---
  y = drawSectionHeader('5. OBSERVAÇÕES DE SAÍDA / NOTAS ADICIONAIS', y);

  const obsHeight = 22;
  doc.setDrawColor(160, 200, 230);
  doc.rect(margin, y, contentWidth, obsHeight);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);

  const obsText = (wo as any)?.exit_observations || (wo as any)?.notes || '';
  const obsLines = obsText ? obsText.split('\n') : [];

  for (let i = 0; i < 5; i++) {
    const lineText = obsLines[i] || '';
    doc.text(`${i + 1} - ${lineText}`, margin + 2.5, y + 3.8 + i * 3.8);
  }

  y += obsHeight + 16;

  // --- ASSINATURAS ---
  const sigWidth = 50;
  const gap = (contentWidth - sigWidth * 3) / 2;

  const sig1X = margin;
  const sig2X = sig1X + sigWidth + gap;
  const sig3X = sig2X + sigWidth + gap;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);

  doc.line(sig1X, y, sig1X + sigWidth, y);
  doc.line(sig2X, y, sig2X + sigWidth, y);
  doc.line(sig3X, y, sig3X + sigWidth, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);

  doc.text('MECÂNICO / TÉCNICO', sig1X + sigWidth / 2, y + 3.5, { align: 'center' });
  doc.text('ENGENHEIRO', sig2X + sigWidth / 2, y + 3.5, { align: 'center' });
  doc.text('CLIENTE', sig3X + sigWidth / 2, y + 3.5, { align: 'center' });

  return doc;
}

// ============ TRAVEL LOG PDF ============
export function generateTravelLogPDF(tl: TravelLog, vehicle: Equipment | undefined): jsPDF {
  const doc = new jsPDF();
  header(doc, 'Guia de Viagem', 'Travel & Vehicle Log', tl.number);

  let y = 38;

  y = sectionTitle(doc, y, 'Identificação');
  y = infoRow(doc, y, 'Motorista/Driver:', tl.driver_name || '—');
  y = infoRow(doc, y, 'Matrícula/Plate:', tl.license_plate || vehicle?.plate_number || '—');
  y = infoRow(doc, y, 'Viatura/Vehicle:', tl.vehicle_name || vehicle?.name || '—');
  y = infoRow(doc, y, 'Destino:', tl.destination || '—');
  y = infoRow(doc, y, 'Objetivo:', tl.purpose || '—', 35);
  y += 3;

  y = checkPageBreak(doc, y, 30);
  y = sectionTitle(doc, y, 'Controlo de Saída & Retorno');

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

  y = checkPageBreak(doc, y, 15);
  y = sectionTitle(doc, y, 'Nível de Combustível');
  y = infoRow(doc, y, 'Fuel Start:', FUEL_LEVEL_LABELS[tl.fuel_start as FuelLevel] || '—');
  y = infoRow(doc, y, 'Fuel End:', FUEL_LEVEL_LABELS[tl.fuel_end as FuelLevel] || '—');
  y += 3;

  if (tl.checklist && tl.checklist.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = sectionTitle(doc, y, 'Checklist de Entrada');
    doc.setFontSize(8);
    tl.checklist.forEach((item) => {
      y = checkPageBreak(doc, y, 7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(item.checked ? 22 : 220, item.checked ? 163 : 38, item.checked ? 74 : 38);
      doc.text(item.checked ? 'SIM' : 'NÃO', MARGIN, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK_COLOR);
      doc.text(item.label, MARGIN + 12, y);
      y += 5.5;
    });
    y += 3;
  }

  y = checkPageBreak(doc, y, 20);
  y = sectionTitle(doc, y, 'Equipa & Notas');
  y = infoRow(doc, y, 'Equipe de Viagem:', tl.travel_team || '—');
  y = infoRow(doc, y, 'Mecânico/Técnico:', tl.mechanic || '—');
  y = infoRow(doc, y, 'Despacho/Dispatcher:', tl.dispatcher || '—');
  y += 3;

  y = infoRow(doc, y, 'Status:', TRAVEL_STATUS_LABELS[tl.status as keyof typeof TRAVEL_STATUS_LABELS] || '—');
  y += 3;

  y = checkPageBreak(doc, y, 30);
  y += 10;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 5, y, MARGIN + 80, y);
  doc.line(PAGE_W - MARGIN - 80, y, PAGE_W - MARGIN - 5, y);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_COLOR);
  doc.text('Assinatura do Motorista', MARGIN + 5, y + 5);
  doc.text('Autorizado por', PAGE_W - MARGIN - 80, y + 5);

  footer(doc);
  return doc;
}

// ============ INSPECTION PDF ============
export function generateInspectionPDF(insp: Inspection, equipment: Equipment | undefined): jsPDF {
  const doc = new jsPDF();
  header(doc, 'Relatório de Inspeção', `Checklist Semanal - ${insp.type}`, `INS-${insp.inspection_date}`);

  let y = 38;

  y = sectionTitle(doc, y, 'Informação do Equipamento');
  y = infoRow(doc, y, 'Equipamento:', equipment?.name || '—');
  y = infoRow(doc, y, 'Número de Série:', equipment?.serial_number || '—');
  y = infoRow(doc, y, 'Localização:', equipment?.location || '—');
  y = infoRow(doc, y, 'Status:', equipment ? EQUIPMENT_STATUS_LABELS[equipment.status] : '—');
  y += 3;

  y = sectionTitle(doc, y, 'Detalhes da Inspeção');
  y = infoRow(doc, y, 'Data:', formatDate(insp.inspection_date));
  y = infoRow(doc, y, 'Tipo:', insp.type.replace(/_/g, ' '));
  y = infoRow(doc, y, 'Inspetor:', insp.inspector_name || '—');
  y = infoRow(doc, y, 'Resultado:', INSPECTION_STATUS_LABELS[insp.status]);
  y += 3;

  y = sectionTitle(doc, y, 'Itens Verificados');
  doc.setFillColor(...LIGHT_BG);
  doc.rect(MARGIN, y - 4, CONTENT_W, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...DARK_COLOR);
  doc.text('Item', MARGIN + 2, y + 0.5);
  doc.text('OK', MARGIN + 140, y + 0.5);
  doc.text('Notas', MARGIN + 155, y + 0.5);
  y += 6;
  doc.setFont('helvetica', 'normal');

  if (insp.checklist && Array.isArray(insp.checklist)) {
    insp.checklist.forEach((item) => {
      y = checkPageBreak(doc, y, 10);
      doc.setTextColor(...DARK_COLOR);
      const labelLines = doc.splitTextToSize(item.label, 130);
      doc.text(labelLines, MARGIN + 2, y);
      doc.setTextColor(item.checked ? 22 : 220, item.checked ? 163 : 38, item.checked ? 74 : 38);
      doc.setFont('helvetica', 'bold');
      doc.text(item.checked ? 'SIM' : 'NÃO', MARGIN + 140, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK_COLOR);
      const noteLines = doc.splitTextToSize(item.note || '', 45);
      doc.text(noteLines, MARGIN + 155, y);
      y += Math.max(5, labelLines.length * 4, noteLines.length * 4) + 1;
    });
  }

  y += 5;
  y = checkPageBreak(doc, y, 20);
  y = sectionTitle(doc, y, 'Notas Gerais');
  y = infoRow(doc, y, 'Notas:', insp.notes || '—', 25);
  y += 5;

  if (insp.signature) {
    y = checkPageBreak(doc, y, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_COLOR);
    doc.text('Assinatura Digital:', MARGIN, y);
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
  doc.text('Assinatura do Inspetor', MARGIN + 5, y + 5);
  doc.text('Aprovação do Supervisor', PAGE_W - MARGIN - 80, y + 5);

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

  doc.setFillColor(15, 30, 50);
  doc.rect(0, 0, PAGE_W, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CHINANGOL, LDA', MARGIN_L, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('SANY DEPARTMENT', MARGIN_L, 18);

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.rect(PAGE_W - MARGIN_R - 50, 6, 50, 14, 'S');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Nº', PAGE_W - MARGIN_R - 47, 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(req.number || 'TT-2026-______', PAGE_W - MARGIN_R - 38, 14);

  doc.setFillColor(199, 89, 48);
  doc.rect(0, 32, PAGE_W, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('REQUISIÇÃO DE PEÇAS E SERVIÇOS', PAGE_W / 2, 39, { align: 'center' });

  let y = 52;

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

  fieldRow('CLIENTE', req.client || '', colL, y, PAGE_W / 2 - MARGIN_L - 4);
  fieldRow('MODELO', req.model || '', colR, y, PAGE_W / 2 - MARGIN_R - 4);
  y += lineH;

  fieldRow('DATA', formatDate(req.created_at), colL, y, PAGE_W / 2 - MARGIN_L - 4);
  fieldRow('SUPERVISOR', req.supervisor_name || '', colR, y, PAGE_W / 2 - MARGIN_R - 4);
  y += lineH;

  fieldRow('Nº SERVIÇO', req.service_number || '', colL, y, PAGE_W / 2 - MARGIN_L - 4);
  fieldRow('Nº SÉRIE', req.serial_number || '', colR, y, PAGE_W / 2 - MARGIN_R - 4);
  y += lineH;

  fieldRow('SOLICITADO POR', req.requested_by || '', colL, y, PAGE_W / 2 - MARGIN_L - 4);
  fieldRow('ASSINATURA', req.supervisor_sign || '', colR, y, PAGE_W / 2 - MARGIN_R - 4);
  y += lineH;

  fieldRow('HORÍMETRO / KM', req.hour_km_meter || '', colL, y, PAGE_W / 2 - MARGIN_L - 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('URGÊNCIA:', colR, y - 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(req.urgency ? 220 : 100, req.urgency ? 38 : 116, req.urgency ? 38 : 139);
  doc.setFont('helvetica', 'bold');
  doc.text(req.urgency ? 'SIM' : 'NÃO', colR + 22, y);
  y += lineH;

  y += 4;
  doc.setFillColor(15, 30, 50);
  doc.rect(MARGIN_L, y, CONTENT_W_R, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ITEM Nº', MARGIN_L + 2, y + 5.5);
  doc.text('QTD.', MARGIN_L + 25, y + 5.5);
  doc.text('CÓDIGO PEÇA', MARGIN_L + 50, y + 5.5);
  doc.text('DESCRIÇÃO DA PEÇA', MARGIN_L + 100, y + 5.5);
  y += 8;

  const colItemNo = MARGIN_L + 2;
  const colQuant = MARGIN_L + 25;
  const colPartsId = MARGIN_L + 50;
  const colDesc = MARGIN_L + 100;
  const rowH = 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  const maxRows = 20;
  for (let i = 0; i < maxRows; i++) {
    const item = items ? items[i] : undefined;
    const rowY = y + i * rowH;

    if (rowY > PAGE_H - 40) break;

    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN_L, rowY, CONTENT_W_R, rowH, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_L, rowY + rowH, MARGIN_L + CONTENT_W_R, rowY + rowH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(String(i + 1), colItemNo + 2, rowY + 5);

    if (item) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(String(item.quantity_requested || item.quantity || ''), colQuant + 1, rowY + 5);
      doc.text(item.part_number || '', colPartsId + 1, rowY + 5);
      const descLines = doc.splitTextToSize(item.description || '', CONTENT_W_R - 100 - 4);
      doc.text(descLines[0] || '', colDesc + 1, rowY + 5);
    }
  }

  y += maxRows * rowH + 6;

  if (y < PAGE_H - 30 && req.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('NOTAS:', MARGIN_L, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const noteLines = doc.splitTextToSize(req.notes || '', CONTENT_W_R - 20);
    doc.text(noteLines, MARGIN_L + 18, y);
    y += noteLines.length * 5 + 6;
  }

  y = Math.max(y, PAGE_H - 35);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_L + 5, y, MARGIN_L + 75, y);
  doc.line(PAGE_W - MARGIN_R - 75, y, PAGE_W - MARGIN_R - 5, y);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Solicitado Por', MARGIN_L + 5, y + 4);
  doc.text('Aprovação do Supervisor', PAGE_W - MARGIN_R - 75, y + 4);

  footer(doc);
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
    return { error: err instanceof Error ? err.message : 'Upload falhou', path: null };
  }
}

export async function getDocumentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('ems-documents').createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

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
