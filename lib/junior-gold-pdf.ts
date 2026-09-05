import { clip, endPath, PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, popGraphicsState, pushGraphicsState, rectangle } from "pdf-lib";
import { JUNIOR_GOLD_PROFILE } from "./junior-gold";
import { validateOverlayText } from "./presidents-badge";

export type JuniorGoldText = { page:number; x:number; y:number; value:string; max:number; size?:number; font?:"F1"|"F2"|"F4" };
export type JuniorGoldMark = { page:number; x:number; y:number; checked:boolean; size?:number };
export type JuniorGoldImage = { page:number; x:number; y:number; width:number; height:number; bytes:Uint8Array; mime:"image/png"|"image/jpeg" };

const literal = (value:string) => value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
const missingWidths:Record<string,number> = {"!":333,'"':408,"#":500,"$":500,"*":500,"+":564,"7":500,"8":500,";":278,"<":564,"=":564,">":564,"?":444,"@":921,"J":389,"U":722,"V":722,"Z":611,"[":333,"\\":278,"]":333,"^":469,"_":500,"`":333,"j":278,"{":480,"|":200,"}":480,"~":541};

function repairFont(pdf:PDFDocument,pageIndex:number){
  const page=pdf.getPage(pageIndex);const resources=pdf.context.lookup(page.node.get(PDFName.of("Resources")),PDFDict);const fonts=pdf.context.lookup(resources.get(PDFName.of("Font")),PDFDict);const font=pdf.context.lookup(fonts.get(PDFName.of("F2")),PDFDict);const first=font.lookup(PDFName.of("FirstChar"),PDFNumber).asNumber();const widths=font.lookup(PDFName.of("Widths"),PDFArray);
  for(const [character,width] of Object.entries(missingWidths)){const index=character.charCodeAt(0)-first;if(index>=0&&index<widths.size()&&widths.lookup(index,PDFNumber).asNumber()===0)widths.set(index,PDFNumber.of(width));}
}
function append(pdf:PDFDocument,pageIndex:number,commands:string){const page=pdf.getPage(pageIndex);const stream=PDFRawStream.of(pdf.context.obj({}),new TextEncoder().encode(commands));const ref=pdf.context.register(stream);const existing=page.node.get(PDFName.of("Contents"));if(existing instanceof PDFArray)existing.push(ref);else{const contents=pdf.context.obj([]) as PDFArray;if(existing)contents.push(existing);contents.push(ref);page.node.set(PDFName.of("Contents"),contents);}}

export async function generateJuniorGoldPdf(master:Uint8Array,overlay:{text:JuniorGoldText[];marks?:JuniorGoldMark[];images?:JuniorGoldImage[]}){
  const pdf=await PDFDocument.load(master,{updateMetadata:false});
  if(pdf.getPageCount()!==JUNIOR_GOLD_PROFILE.pageCount)throw new Error("The official Junior Gold Award form must contain exactly two pages.");
  for(const [index,page] of pdf.getPages().entries()){const {width,height}=page.getSize();if(Math.abs(width-JUNIOR_GOLD_PROFILE.pageWidth)>1||Math.abs(height-JUNIOR_GOLD_PROFILE.pageHeight)>1)throw new Error(`Page ${index+1} does not match the official A4 layout.`);repairFont(pdf,index);}
  const commands=new Map<number,string[]>();
  for(const field of overlay.text){const value=validateOverlayText(field.value,"PDF field",field.max);if(!value)continue;const page=field.page-1;const values=commands.get(page)??[];values.push(`q BT /${field.font??"F2"} ${field.size??8} Tf 1 0 0 1 ${field.x} ${field.y} Tm (${literal(value)}) Tj ET Q`);commands.set(page,values);}
  for(const mark of overlay.marks??[]){if(!mark.checked)continue;const page=mark.page-1;const values=commands.get(page)??[];const size=mark.size??7;values.push(`q 0.9 w ${mark.x} ${mark.y} m ${mark.x+size} ${mark.y+size} l S ${mark.x+size} ${mark.y} m ${mark.x} ${mark.y+size} l S Q`);commands.set(page,values);}
  for(const [page,values] of commands)append(pdf,page,values.join("\n"));
  for(const image of overlay.images??[]){const embedded=image.mime==="image/png"?await pdf.embedPng(image.bytes):await pdf.embedJpg(image.bytes);const ratio=embedded.width/embedded.height;const box=image.width/image.height;let width=image.width,height=image.height;if(ratio>box)width=image.height*ratio;else height=image.width/ratio;const page=pdf.getPage(image.page-1);page.pushOperators(pushGraphicsState(),rectangle(image.x,image.y,image.width,image.height),clip(),endPath());page.drawImage(embedded,{x:image.x+(image.width-width)/2,y:image.y+(image.height-height)/2,width,height});page.pushOperators(popGraphicsState());}
  return new Uint8Array(await pdf.save({useObjectStreams:false,addDefaultPage:false,updateFieldAppearances:false}));
}

export const AWA_JR01_COORDINATES = {
  companyNumber:{page:1,x:102,y:582,max:12},companyName:{page:1,x:170,y:582,max:36},state:{page:1,x:350,y:582,max:30},
  awardsOfficerName:{page:1,x:128,y:558,max:36},awardsOfficerRank:{page:1,x:360,y:558,max:22},awardsOfficerEmail:{page:1,x:355,y:534,max:38},
  candidateName:{page:1,x:112,y:493,max:44},gender:{page:1,x:330,y:481,max:2},rank:{page:1,x:470,y:493,max:20},candidateEmail:{page:1,x:354,y:443,max:38},
  nricFirst:{page:1,x:104,y:455.45,max:6,size:8},nricMiddle:{page:1,x:184.5,y:455.45,max:2,size:8},nricLast:{page:1,x:260.5,y:455.45,max:4,size:8},
  birthDateDay:{page:1,x:365.7,y:455.45,max:2,size:6},birthDateMonth:{page:1,x:429.3,y:455.45,max:2,size:6},birthDateYear:{page:1,x:485.6,y:455.45,max:4,size:6},
  passportPhoto:{page:1,x:460,y:655,width:93,height:132},captainName:{page:1,x:160,y:104,max:36,size:7},
} as const;
