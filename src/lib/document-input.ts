/** Browser-only document extraction: no source file is uploaded to a third party. */
export async function extractDocument(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  let text = "";
  if (/\.(txt|md|csv)$/.test(name)) text = await file.text();
  else if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const loading = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const doc = await loading.promise;
    const pages: string[] = [];
    for (let i=1;i<=doc.numPages;i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item=>"str" in item?item.str:"").join(" "));
    }
    text = pages.join("\n\n");
    await loading.destroy();
  } else if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser");
    text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  } else if (name.endsWith(".pptx")) {
    const { unzipSync, strFromU8 } = await import("fflate");
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
    text = Object.keys(entries).filter(k=>/^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0])).map(k=>{
      const bytes=entries[k];
      if(!bytes)return "";
      const xml = new DOMParser().parseFromString(strFromU8(bytes),"application/xml");
      return Array.from(xml.getElementsByTagName("a:t")).map(n=>n.textContent??"").join(" ");
    }).join("\n\n");
  } else throw new Error("Choose a PDF, DOCX, PPTX or text file.");
  if (text.trim().length<20) throw new Error("No readable text found. Scanned documents need text recognition before uploading.");
  return text.trim();
}