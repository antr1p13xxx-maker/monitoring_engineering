const SHEET_NAME = "Database_Engineering";

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Monitoring Design & Drawing Engineering & KPI')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { sheet = ss.insertSheet(SHEET_NAME); } else { sheet.clear(); }

  const headers = [
    "No", "Bulan", "SPK", "Nomor PO", "Customer", "Status", "Delivery Time", "Nama Project", 
    "PIC", "Qty Drawing", "Permintaan Drawing/Design", "Target Design", "Tanggal Penyelesaian", 
    "Aktual Engineering", "File CAD Drive", "Konsep 3D/2D", "APPROVAL", "3D", "2D", "LIST STANDARD PART", 
    "list material", "IRD", "Squence", "animation", "dokumentasi", "layout pengiriman", 
    "drawing box pengiriman", "simulation", "penawaran", "keterangan"
  ];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);
  return "Database spreadsheet berhasil diinisialisasi!";
}

function getBaseTemplate() {
  return [
    { id: 1, no: "1", objective: "Design Quality (Kualitas Desain)", kpi: "Mengukur seberapa baik desain yang dibuat memenuhi standar kualitas yang ditentukan.", bobot: 0.20, unit: "%", target: "≥ 90%", targetVal: 90, ruleType: "gte", measurementBasis: "Target: ≥ 90% desain diterima tanpa revisi signifikan.\nMetode Pengukuran: Review desain, feedback dari tim produksi.", ruleDesc: "Target: ≥ 90%, bila nilai aktual ≥ 90% maka status tercapai.", keterangan: "", months: { Jan: null, Feb: null, Mar: null, Apr: null, Mei: null, Jun: null, Jul: null, Aug: null, Sep: null, Okt: null, Nop: null, Des: null } },
    { id: 2, no: "2", objective: "On-Time Design", kpi: "Mengukur sejauh mana desain selesai sesuai jadwal yang ditetapkan", bobot: 0.15, unit: "%", target: "≥ 95%", targetVal: 95, ruleType: "gte", measurementBasis: "Target: ≥ 95% proyek desain selesai tepat waktu.\nMetode Pengukuran: Monitoring timeline proyek", ruleDesc: "Target: ≥ 95%, bila nilai aktual ≥ 95% maka status tercapai.", keterangan: "", months: { Jan: null, Feb: null, Mar: null, Apr: null, Mei: null, Jun: null, Jul: null, Aug: null, Sep: null, Okt: null, Nop: null, Des: null } },
    { id: 3, no: "3", objective: "Distribusi Drawing", kpi: "Waktu yang diperlukan untuk menyelesaikan desain dari awal hingga siap untuk diproduksi atau di trial", bobot: 0.15, unit: "%", target: "≤ 10%", targetVal: 10, ruleType: "lte", measurementBasis: "Target: ≤ 10% keterlambatan dari jadwal yang direncanakan.\nMetode Pengukuran: Monitoring timeline proyek.", ruleDesc: "Target: ≤ 10%, bila nilai aktual ≤ 10% maka status tercapai.", keterangan: "", months: { Jan: null, Feb: null, Mar: null, Apr: null, Mei: null, Jun: null, Jul: null, Aug: null, Sep: null, Okt: null, Nop: null, Des: null } },
    { id: 4, no: "4", objective: "Design Cost Efficiency (Efisiensi Biaya Desain)", kpi: "Mengukur efisiensi biaya dalam proses desain, termasuk penggunaan sumber daya dan material.", bobot: 0.15, unit: "%", target: "≤ 95%", targetVal: 95, ruleType: "lte", measurementBasis: "Target: Menggunakan ≤ 95% dari anggaran desain yang ditetapkan.\nMetode Pengukuran: Laporan anggaran dan pengeluaran.", ruleDesc: "Target: ≤ 95%, bila nilai aktual ≤ 95% maka status tercapai.", keterangan: "", months: { Jan: null, Feb: null, Mar: null, Apr: null, Mei: null, Jun: null, Jul: null, Aug: null, Sep: null, Okt: null, Nop: null, Des: null } },
    { id: 5, no: "5", objective: "Design Error Rate (Tingkat Kesalahan Desain)", kpi: "Mengukur jumlah kesalahan yang terjadi selama atau setelah fase desain.", bobot: 0.15, unit: "%", target: "≤ 2%", targetVal: 2, ruleType: "lte", measurementBasis: "Target: ≤ 2% dari total desain yang diproduksi.\nMetode Pengukuran: Laporan kesalahan dr berbagai devisi dan revisi desain.", ruleDesc: "Target: ≤ 2%, bila nilai aktual ≤ 2% maka status tercapai.", keterangan: "", months: { Jan: null, Feb: null, Mar: null, Apr: null, Mei: null, Jun: null, Jul: null, Aug: null, Sep: null, Okt: null, Nop: null, Des: null } },
    { id: 6, no: "6", objective: "5R (Ringkas Rapi Resik Rawat Rajin)", kpi: "Implementasi 5R di area kerja Departemen Engineering.", bobot: 0.05, unit: "%", target: "100%", targetVal: 100, ruleType: "eq_100_percent", measurementBasis: "Target: 100% implementasi 5R.\nMetode Pengukuran: Berdasarkan skor lembar audit Workshop Assessment 5R bulanan.", ruleDesc: "Target: 100%, bila kurang dari 100% status menjadi perhatian.", keterangan: "", months: { Jan: null, Feb: null, Mar: null, Apr: null, Mei: null, Jun: null, Jul: null, Aug: null, Sep: null, Okt: null, Nop: null, Des: null } },
    { id: 7, no: "7", objective: "Health, Safety, and Environment (HSE)", kpi: "Zero Accident dan kegiatan Safety Briefing rutin bulanan.", bobot: 0.05, unit: "Angka", target: "0 Accident", targetVal: 0, ruleType: "eq_zero_accident", measurementBasis: "Target: 0 Accident.\nMetode Pengukuran: Jumlah insiden kecelakaan kerja (Zero Accident) & absensi safety briefing.", ruleDesc: "Target: 0 accident, bila lebih dari 0 status menjadi perhatian.", keterangan: "", months: { Jan: null, Feb: null, Mar: null, Apr: null, Mei: null, Jun: null, Jul: null, Aug: null, Sep: null, Okt: null, Nop: null, Des: null } },
    { id: 8, no: "8", objective: "Pengembangan Karyawan (Internal)", kpi: "Pengembangan kompetensi Karyawan di internal Departemen Engineering.", bobot: 0.05, unit: "%", target: "100%", targetVal: 100, ruleType: "eq_100_percent", measurementBasis: "Target: 100% pengembangan kompetensi.\nMetode Pengukuran: Realisasi jam pelatihan internal dan sertifikasi kompetensi staf.", ruleDesc: "Target: 100%, bila kurang dari 100% status menjadi perhatian.", keterangan: "", months: { Jan: null, Feb: null, Mar: null, Apr: null, Mei: null, Jun: null, Jul: null, Aug: null, Sep: null, Okt: null, Nop: null, Des: null } },
    { id: 9, no: "9", objective: "Kesesuaian SOP / Prosedur", kpi: "Kesesuaian pelaksanaan kerja terhadap SOP & Prosedur yang berlaku.", bobot: 0.05, unit: "%", target: "100%", targetVal: 100, ruleType: "eq_100_percent", measurementBasis: "Target: 100% kesesuaian SOP.\nMetode Pengukuran: Audit kepatuhan SOP internal oleh tim Quality Assurance / ISO.", ruleDesc: "Target: 100%, bila kurang dari 100% status menjadi perhatian.", keterangan: "", months: { Jan: null, Feb: null, Mar: null, Apr: null, Mei: null, Jun: null, Jul: null, Aug: null, Sep: null, Okt: null, Nop: null, Des: null } }
  ];
}

function cleanData(rows) {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0];
  const timeZone = Session.getScriptTimeZone();
  return rows.slice(1).map((row, index) => {
    let obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, timeZone, "yyyy-MM-dd");
      }
      obj[h] = val !== null && val !== undefined ? String(val) : "";
    });
    obj["No"] = index + 1;
    return obj;
  });
}

function getAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { setupDatabase(); sheet = ss.getSheetByName(SHEET_NAME); }
  
  const rows = sheet.getDataRange().getValues();
  const monitoringData = cleanData(rows);

  let kpiSheet = ss.getSheetByName('KPI_Data');
  if (!kpiSheet) { kpiSheet = ss.insertSheet('KPI_Data'); kpiSheet.appendRow(['Year', 'KPI_ID', 'Month', 'Value', 'Keterangan']); }

  var yearsData = { "2026": getBaseTemplate(), "2027": getBaseTemplate(), "2028": getBaseTemplate(), "2029": getBaseTemplate(), "2030": getBaseTemplate() };
  var kpiRows = kpiSheet.getDataRange().getValues();
  if (kpiRows.length > 1) {
    for (var i = 1; i < kpiRows.length; i++) {
      var year = kpiRows[i][0].toString();
      var kpiId = parseInt(kpiRows[i][1]);
      var month = kpiRows[i][2];
      var value = kpiRows[i][3];
      var ket = kpiRows[i][4] || "";
      if (yearsData[year]) {
        var kpiItem = yearsData[year].find(item => item.id === kpiId);
        if (kpiItem) {
          if (kpiItem.months.hasOwnProperty(month)) kpiItem.months[month] = value !== "" ? parseFloat(value) : null;
          if (ket !== "") kpiItem.keterangan = ket;
        }
      }
    }
  }
  
  return { data: monitoringData, yearsData: yearsData, config: { lastSync: new Date().toLocaleString() } };
}

function saveData(formData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const spkTarget = formData.SPK;
  let rowIndexToUpdate = -1;
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf("SPK")] === spkTarget) { rowIndexToUpdate = i + 1; break; }
  }
  
  const rowValues = headers.map(h => h === "No" ? (rowIndexToUpdate !== -1 ? rows[rowIndexToUpdate - 1][0] : rows.length) : (formData[h] !== undefined ? formData[h] : ""));
  if (rowIndexToUpdate !== -1) { sheet.getRange(rowIndexToUpdate, 1, 1, rowValues.length).setValues([rowValues]); }
  else { sheet.appendRow(rowValues); }
  return getAllData();
}

function deleteData(index) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  sheet.deleteRow(index + 2);
  return getAllData();
}

function uploadFileToDrive(fileData) {
  const folderName = "CAD_Drawings_Cloud";
  let folders = DriveApp.getFoldersByName(folderName);
  let folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  const blob = Utilities.newBlob(Utilities.base64Decode(fileData.bytes), fileData.mimeType, fileData.fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  const fileUrl = file.getUrl();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf("SPK")] === fileData.spk) {
      sheet.getRange(i + 1, headers.indexOf("File CAD Drive") + 1).setValue(fileUrl);
      break;
    }
  }
  return getAllData();
}

function sendEmailReport(recipient, subject, body) {
  MailApp.sendEmail(recipient, subject, body);
  return "Email berhasil dikirim!";
}