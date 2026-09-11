export async function exportPdf(source: HTMLElement, filename: string) {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  await document.fonts.ready;
  // Render at paper width even when the preview is viewed on a phone.
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("data-no-translate", "");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:760px;pointer-events:none;background:white";
  const copy = source.cloneNode(true) as HTMLElement;
  copy.dir = getComputedStyle(source).direction;
  copy.style.cssText = "width:760px;max-width:none;height:auto;max-height:none;overflow:visible;padding:20px;background:white;color:#0f172a;font-family:" + getComputedStyle(source).fontFamily;
  copy.querySelectorAll<HTMLElement>("table").forEach((table) => { table.style.width = "100%"; table.style.minWidth = "0"; table.style.tableLayout = "fixed"; });
  copy.querySelectorAll<HTMLElement>("th,td").forEach((cell) => { cell.style.overflowWrap = "anywhere"; });
  host.append(copy);
  document.body.append(host);
  try {
    const canvas = await toCanvas(copy, { pixelRatio: 2, backgroundColor: "#ffffff" });
    const scale = canvas.width / copy.getBoundingClientRect().width;
    const top = copy.getBoundingClientRect().top;
    const bounds = Array.from(copy.querySelectorAll("tbody tr"), (row) => {
      const rect = row.getBoundingClientRect();
      return { top: Math.floor((rect.top - top) * scale), bottom: Math.ceil((rect.bottom - top) * scale) };
    });
    const head = copy.querySelector("thead")?.getBoundingClientRect();
    const headerTop = head ? Math.floor((head.top - top) * scale) : 0;
    const headerHeight = head ? Math.ceil(head.height * scale) : 0;
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const width = 182;
    const maxHeight = Math.floor(canvas.width * 269 / width);
    let offset = 0;
    let page = 0;
    while (offset < canvas.height) {
      const repeatHeader = page > 0 && bounds.some((row) => row.bottom > offset) ? headerHeight : 0;
      let end = Math.min(canvas.height, offset + maxHeight - repeatHeader);
      const crossing = bounds.find((row) => row.top < end && row.bottom > end);
      if (crossing && crossing.top > offset) end = crossing.top;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = end - offset + repeatHeader;
      const context = slice.getContext("2d");
      if (!context) throw new Error("PDF could not be created");
      context.fillStyle = "white";
      context.fillRect(0, 0, slice.width, slice.height);
      if (repeatHeader) context.drawImage(canvas, 0, headerTop, canvas.width, headerHeight, 0, 0, canvas.width, headerHeight);
      context.drawImage(canvas, 0, offset, canvas.width, end - offset, 0, repeatHeader, canvas.width, end - offset);
      if (page) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/png"), "PNG", 14, 14, width, slice.height / slice.width * width);
      offset = end;
      page += 1;
    }
    pdf.save(`${filename}.pdf`);
  } finally {
    host.remove();
  }
}
