export type GuideLanguage = "en" | "zh" | "ms";

export type GuideDefinition = {
  key: string;
  title: string;
  purpose: string;
  recommendation: string;
  steps: string[];
  targetRoute: string;
};

const routeGuides: Record<string, string> = {
  home: "home",
  manage: "manage",
  members: "members",
  officers: "members",
  associates: "members",
  attendance: "attendance",
  awards: "awards",
  submissions: "awards",
  events: "events",
  parades: "events",
  duties: "events",
  committees: "events",
  resources: "resources",
  subscriptions: "subscriptions",
  uniforms: "stock",
  stock: "stock",
  admin: "accounts",
  onboarding: "onboarding",
  automation: "accounts",
  exports: "exports",
  "company-statistics": "statistics",
  help: "home",
};

const copy: Record<GuideLanguage, Record<string, GuideDefinition>> = {
  en: {
    home: { key: "home", title: "Use your Home page", purpose: "Home gathers your urgent work, personal or company summary and common actions.", recommendation: "Open the most urgent task first, then work through the remaining categories.", targetRoute: "home", steps: ["Review urgent tasks and their due dates.", "Choose a task category to see normal work.", "Open the linked record and confirm the action yourself."] },
    manage: { key: "manage", title: "Manage company work", purpose: "Manage groups requests, stock and administration according to your permissions.", recommendation: "Start with any category showing a count badge.", targetRoute: "manage", steps: ["Choose Requests, Stock or Administration.", "Open the item that needs attention.", "Review the details before confirming an official change."] },
    members: { key: "members", title: "Manage people safely", purpose: "Member and Officer directories hold official profile information and progress.", recommendation: "Search for one person, open their profile, then use the available action.", targetRoute: "members", steps: ["Choose Senior or Junior and search by name.", "Open the person’s profile to review all details.", "Use Edit only if permitted, then verify the success message before repeating."] },
    attendance: { key: "attendance", title: "Complete attendance", purpose: "Attendance records apply only to meetings that have occurred and to the members expected at that meeting.", recommendation: "Open the closest incomplete register and clear every unmarked record.", targetRoute: "attendance", steps: ["Select the correct meeting and squad.", "Use Mark all present only when everyone attended.", "Review Present, Absent, Excused and Unmarked totals before leaving."] },
    awards: { key: "awards", title: "Track awards and submissions", purpose: "The matrix shows official progress; submissions request review without directly awarding anything.", recommendation: "Open the member or submission that is awaiting action.", targetRoute: "awards", steps: ["Select the correct section and award category.", "Review current status or submit supporting information.", "An authorised reviewer must confirm any official award decision."] },
    events: { key: "events", title: "Plan meetings and programme", purpose: "Programme tools cover meetings, parade plans, duties and committee work.", recommendation: "Check upcoming meetings before creating a new event.", targetRoute: "events", steps: ["Choose the correct audience, section and date.", "Add the programme information members need.", "Review the attendance-register option, then publish or save the plan."] },
    resources: { key: "resources", title: "Find company resources", purpose: "Resources are filtered by role so users see only material they are allowed to access.", recommendation: "Search first, then narrow the category if needed.", targetRoute: "resources", steps: ["Search by title or keyword.", "Choose a permitted resource category.", "Open or download the file without sharing restricted links."] },
    subscriptions: { key: "subscriptions", title: "Review subscriptions", purpose: "Company and Band subscription registers track yearly payment status without displaying amounts.", recommendation: "Choose the year and resolve records still marked unpaid.", targetRoute: "subscriptions", steps: ["Select the correct section and year.", "Check whether the member belongs to Band.", "Update the status once and wait for confirmation."] },
    stock: { key: "stock", title: "Handle requests and stock", purpose: "Uniform requests, inventory, issues and returns are linked in one controlled workflow.", recommendation: "Process Pending requests before reviewing low stock.", targetRoute: "stock", steps: ["Confirm the member, item, condition and available quantity.", "Move requests through Approved and Ready for collection.", "Confirm the handover once; defective items must not be issued."] },
    accounts: { key: "accounts", title: "Manage accounts and access", purpose: "Accounts, roles, branding and automation determine who can use each area.", recommendation: "Use the normal role first and add only the extra permissions required.", targetRoute: "admin", steps: ["Search for the account and confirm its linked member.", "Check role, squad, status and any expiry date.", "Save once and verify the confirmation and updated account row."] },
    onboarding: { key: "onboarding", title: "Complete onboarding", purpose: "Onboarding protects accounts and verifies profile, privacy and role guidance before normal access.", recommendation: "Complete the first unfinished step shown on screen.", targetRoute: "onboarding", steps: ["Replace the temporary password.", "Verify the linked profile or request a correction.", "Accept the privacy notice and finish the role checklist."] },
    exports: { key: "exports", title: "Create a safe export", purpose: "Export Centre separates privacy-safe school reports from authorised full backups.", recommendation: "Choose the smallest report and dataset that meets the purpose.", targetRoute: "exports", steps: ["Choose report type, year, section, squad and school.", "Review the privacy summary and included fields.", "Generate the file once and store it securely."] },
    statistics: { key: "statistics", title: "Prepare Company Statistics", purpose: "Company Statistics are calculated from Member, Officer, Associate and Alumni records.", recommendation: "Correct missing classifications in the source profile rather than changing totals here.", targetRoute: "company-statistics", steps: ["Review the completeness and reconciliation warnings.", "Open the linked directory to correct gender, ethnicity, rank or status.", "Return to refresh the totals, then export the reporting year."] },
  },
  zh: {
    home: { key: "home", title: "使用主页", purpose: "主页集中显示紧急事项、个人或连队摘要及常用操作。", recommendation: "先处理最紧急的事项，再查看其他分类。", targetRoute: "home", steps: ["查看紧急事项和截止日期。", "选择事项分类查看一般工作。", "打开相关记录，并由您亲自确认操作。"] },
    manage: { key: "manage", title: "管理连队工作", purpose: "“管理”按权限整理申请、库存和行政工作。", recommendation: "先打开有数字提示的分类。", targetRoute: "manage", steps: ["选择申请、库存或行政。", "打开需要处理的项目。", "确认正式更改前检查所有资料。"] },
    members: { key: "members", title: "安全管理人员资料", purpose: "会员和军官名录保存正式个人资料与进度。", recommendation: "搜索一人、打开档案，再选择允许的操作。", targetRoute: "members", steps: ["选择高年组或初级组并搜索姓名。", "打开个人档案检查全部资料。", "如有权限才编辑，并等待成功提示。"] },
    attendance: { key: "attendance", title: "完成点名", purpose: "点名只计算已经举行的会议及该会议应出席的人。", recommendation: "打开最接近且未完成的点名表。", targetRoute: "attendance", steps: ["选择正确会议和小队。", "只有全员出席时才使用全部出席。", "离开前检查出席、缺席、请假和未标记总数。"] },
    awards: { key: "awards", title: "追踪奖章与申请", purpose: "奖章矩阵显示正式进度；申请不会直接授予奖章。", recommendation: "打开等待处理的会员或申请。", targetRoute: "awards", steps: ["选择正确组别和奖章分类。", "检查状态或提交证明。", "正式奖章决定必须由获授权人员确认。"] },
    events: { key: "events", title: "规划会议与活动", purpose: "活动工具包括会议、操练计划、值勤和委员会工作。", recommendation: "新增活动前先检查现有会议。", targetRoute: "events", steps: ["选择对象、组别和日期。", "填写会员需要的活动资料。", "检查点名表选项后再发布或保存。"] },
    resources: { key: "resources", title: "查找连队资源", purpose: "资源依角色过滤，只显示获准查看的内容。", recommendation: "先搜索，再按分类筛选。", targetRoute: "resources", steps: ["按标题或关键词搜索。", "选择获准的资源分类。", "打开或下载资料，不要分享受限链接。"] },
    subscriptions: { key: "subscriptions", title: "检查年费记录", purpose: "连队和乐队年费只记录每年付款状态，不显示金额。", recommendation: "选择年份并处理未付款记录。", targetRoute: "subscriptions", steps: ["选择正确组别和年份。", "确认会员是否参加乐队。", "更新一次并等待成功提示。"] },
    stock: { key: "stock", title: "处理申请与库存", purpose: "制服申请、库存、发放和归还属于同一受控流程。", recommendation: "先处理待审核申请，再查看低库存。", targetRoute: "stock", steps: ["确认会员、物品、状况和可用数量。", "依次更新为批准和可领取。", "交付只确认一次；损坏物品不可发放。"] },
    accounts: { key: "accounts", title: "管理账号与权限", purpose: "账号、角色、品牌和自动化决定每人可使用的范围。", recommendation: "先设置一般角色，只添加必要的额外权限。", targetRoute: "admin", steps: ["搜索账号并确认关联会员。", "检查角色、小队、状态和到期日。", "保存一次并确认账号列表已更新。"] },
    onboarding: { key: "onboarding", title: "完成账号启用", purpose: "启用流程保护账号，并在开放正常使用前确认资料、隐私和角色说明。", recommendation: "完成画面显示的第一个未完成步骤。", targetRoute: "onboarding", steps: ["更换临时密码。", "确认会员档案或申请更正。", "接受隐私声明并完成角色清单。"] },
    exports: { key: "exports", title: "安全导出资料", purpose: "导出中心区分学校报告和获授权的完整备份。", recommendation: "只选择达到目的所需的最小资料范围。", targetRoute: "exports", steps: ["选择报告、年份、组别、小队和学校。", "检查隐私说明和包含字段。", "只生成一次并安全保存。"] },
    statistics: { key: "statistics", title: "准备连队统计", purpose: "统计数据来自会员、军官、关联会员和校友档案。", recommendation: "请在原始档案更正分类，不要在统计页改总数。", targetRoute: "company-statistics", steps: ["检查完整度和对账警告。", "打开相关名录更正性别、族群、军阶或状态。", "返回刷新总数后导出年度报告。"] },
  },
  ms: {
    home: { key: "home", title: "Gunakan halaman Utama", purpose: "Utama mengumpulkan tugas segera, ringkasan dan tindakan lazim anda.", recommendation: "Buka tugas paling penting dahulu, kemudian semak kategori lain.", targetRoute: "home", steps: ["Semak tugas segera dan tarikh akhirnya.", "Pilih kategori untuk melihat kerja biasa.", "Buka rekod berkaitan dan sahkan sendiri tindakan rasmi."] },
    manage: { key: "manage", title: "Urus kerja kompeni", purpose: "Urus mengumpulkan permohonan, stok dan pentadbiran mengikut kebenaran anda.", recommendation: "Mulakan dengan kategori yang mempunyai lencana bilangan.", targetRoute: "manage", steps: ["Pilih Permohonan, Stok atau Pentadbiran.", "Buka perkara yang memerlukan tindakan.", "Semak butiran sebelum mengesahkan perubahan rasmi."] },
    members: { key: "members", title: "Urus rekod dengan selamat", purpose: "Direktori ahli dan pegawai menyimpan profil rasmi dan kemajuan.", recommendation: "Cari seorang, buka profilnya, kemudian pilih tindakan yang dibenarkan.", targetRoute: "members", steps: ["Pilih Seksyen Senior atau Junior dan cari nama.", "Buka profil untuk menyemak semua butiran.", "Edit hanya jika dibenarkan dan tunggu mesej berjaya."] },
    attendance: { key: "attendance", title: "Lengkapkan kehadiran", purpose: "Kehadiran hanya melibatkan mesyuarat yang telah berlaku dan ahli yang diwajibkan hadir.", recommendation: "Buka daftar tidak lengkap yang paling hampir.", targetRoute: "attendance", steps: ["Pilih mesyuarat dan skuad yang betul.", "Gunakan Tandakan semua hadir hanya jika semua hadir.", "Semak jumlah Hadir, Tidak hadir, Bersebab dan Belum ditanda."] },
    awards: { key: "awards", title: "Jejaki anugerah dan permohonan", purpose: "Matriks menunjukkan kemajuan rasmi; permohonan tidak memberi anugerah secara langsung.", recommendation: "Buka ahli atau permohonan yang menunggu tindakan.", targetRoute: "awards", steps: ["Pilih seksyen dan kategori anugerah.", "Semak status atau serahkan bukti.", "Keputusan rasmi mesti disahkan oleh pegawai yang diberi kuasa."] },
    events: { key: "events", title: "Rancang mesyuarat dan program", purpose: "Alat program merangkumi mesyuarat, rancangan perbarisan, tugas dan jawatankuasa.", recommendation: "Semak mesyuarat akan datang sebelum mencipta acara.", targetRoute: "events", steps: ["Pilih peserta, seksyen dan tarikh.", "Isi maklumat program yang diperlukan.", "Semak pilihan daftar kehadiran sebelum menerbitkan."] },
    resources: { key: "resources", title: "Cari sumber kompeni", purpose: "Sumber ditapis mengikut peranan dan hanya bahan yang dibenarkan dipaparkan.", recommendation: "Cari dahulu, kemudian tapis kategori.", targetRoute: "resources", steps: ["Cari mengikut tajuk atau kata kunci.", "Pilih kategori sumber yang dibenarkan.", "Buka atau muat turun tanpa berkongsi pautan terhad."] },
    subscriptions: { key: "subscriptions", title: "Semak langganan", purpose: "Daftar kompeni dan pancaragam merekod status bayaran tahunan tanpa memaparkan amaun.", recommendation: "Pilih tahun dan selesaikan rekod belum bayar.", targetRoute: "subscriptions", steps: ["Pilih seksyen dan tahun.", "Pastikan sama ada ahli menyertai pancaragam.", "Kemas kini sekali dan tunggu pengesahan."] },
    stock: { key: "stock", title: "Urus permohonan dan stok", purpose: "Permohonan uniform, inventori, pengeluaran dan pemulangan berada dalam satu aliran terkawal.", recommendation: "Proses permohonan Tertunda sebelum menyemak stok rendah.", targetRoute: "stock", steps: ["Sahkan ahli, item, keadaan dan kuantiti tersedia.", "Gerakkan permohonan ke Diluluskan dan Sedia diambil.", "Sahkan serahan sekali sahaja; item rosak tidak boleh dikeluarkan."] },
    accounts: { key: "accounts", title: "Urus akaun dan akses", purpose: "Akaun, peranan, penjenamaan dan automasi menentukan capaian setiap pengguna.", recommendation: "Gunakan peranan biasa dahulu dan tambah hanya kebenaran yang perlu.", targetRoute: "admin", steps: ["Cari akaun dan sahkan ahli yang dipautkan.", "Semak peranan, skuad, status dan tarikh luput.", "Simpan sekali dan pastikan senarai akaun dikemas kini."] },
    onboarding: { key: "onboarding", title: "Lengkapkan orientasi", purpose: "Orientasi melindungi akaun dan mengesahkan profil, privasi dan panduan peranan.", recommendation: "Lengkapkan langkah pertama yang belum selesai.", targetRoute: "onboarding", steps: ["Gantikan kata laluan sementara.", "Sahkan profil atau minta pembetulan.", "Terima notis privasi dan habiskan senarai peranan."] },
    exports: { key: "exports", title: "Cipta eksport selamat", purpose: "Pusat Eksport memisahkan laporan sekolah daripada sandaran penuh yang dibenarkan.", recommendation: "Pilih laporan dan data paling minimum yang memenuhi tujuan.", targetRoute: "exports", steps: ["Pilih jenis laporan, tahun, seksyen, skuad dan sekolah.", "Semak ringkasan privasi dan medan disertakan.", "Jana sekali dan simpan fail dengan selamat."] },
    statistics: { key: "statistics", title: "Sediakan Statistik Kompeni", purpose: "Statistik dikira daripada rekod Ahli, Pegawai, Ahli Bersekutu dan Alumni.", recommendation: "Betulkan klasifikasi dalam profil sumber, bukan jumlah di halaman ini.", targetRoute: "company-statistics", steps: ["Semak amaran kelengkapan dan penyelarasan.", "Buka direktori berkaitan untuk membetulkan jantina, etnik, pangkat atau status.", "Kembali, segarkan jumlah dan eksport tahun laporan."] },
  },
};

export function normaliseGuideLanguage(value: unknown): GuideLanguage {
  return value === "zh" || value === "ms" ? value : "en";
}

export function guideForRoute(route: string, language: GuideLanguage) {
  const key = routeGuides[route] ?? "home";
  return copy[language][key] ?? copy.en[key] ?? copy.en.home;
}

export function guideAccessSummary(
  role: string,
  language: GuideLanguage,
  context: { squad?: string; section?: string; hasCustomAccess?: boolean } = {},
) {
  const squad = context.squad?.trim();
  const section = context.section?.trim();
  const summaries = {
    en: role === "viewer" ? "Viewer access is read-only. You can inspect permitted records but cannot save changes." : role === "member" ? `You can view your own${section ? ` ${section}` : ""} records and submit personal requests. Official records remain read-only.` : ["nco", "squad_leader"].includes(role) ? `Your people and attendance access is limited to ${squad ? `${squad} Squad` : "your assigned squad"}. Official award decisions remain restricted.` : `Your staff role can manage authorised company records. Every official decision still requires your confirmation.${context.hasCustomAccess ? " Additional custom access is still checked by the server." : ""}`,
    zh: role === "viewer" ? "访客权限为只读；您可查看获准记录，但不能保存更改。" : role === "member" ? `您可查看自己的${section ? ` ${section}` : ""}记录和提交个人申请；正式记录为只读。` : ["nco", "squad_leader"].includes(role) ? `会员与点名权限只限${squad ? `${squad} 小队` : "所属小队"}；正式奖章决定仍受限制。` : `您的职员角色可管理获准的连队记录；每项正式决定仍需您确认。${context.hasCustomAccess ? "额外自定义权限仍由服务器检查。" : ""}`,
    ms: role === "viewer" ? "Akses Pemerhati adalah baca sahaja. Anda boleh melihat rekod yang dibenarkan tetapi tidak boleh menyimpan perubahan." : role === "member" ? `Anda boleh melihat rekod${section ? ` ${section}` : ""} sendiri dan menghantar permohonan peribadi. Rekod rasmi kekal baca sahaja.` : ["nco", "squad_leader"].includes(role) ? `Akses ahli dan kehadiran anda terhad kepada ${squad ? `Skuad ${squad}` : "skuad yang ditugaskan"}. Keputusan anugerah rasmi kekal terhad.` : `Peranan staf anda boleh mengurus rekod kompeni yang dibenarkan. Setiap keputusan rasmi masih memerlukan pengesahan anda.${context.hasCustomAccess ? " Akses tersuai tambahan masih diperiksa oleh pelayan." : ""}`,
  };
  return summaries[language];
}

export const guideUiCopy = {
  en: { label: "BB GUIDE", heading: "Help me", page: "About this page", access: "Your access", next: "Recommended next step", steps: "Guided steps", complete: "Mark step complete", done: "Completed", open: "Open this area", tutorials: "All tutorials", close: "Close BB Guide", language: "Guide language", progress: "Guide progress", success: "The app confirmed your action. Guide progress was updated." },
  zh: { label: "BB 指南", heading: "帮助我", page: "本页用途", access: "您的权限", next: "建议下一步", steps: "引导步骤", complete: "标记此步骤完成", done: "已完成", open: "打开此区域", tutorials: "全部教程", close: "关闭 BB 指南", language: "指南语言", progress: "指南进度", success: "应用已确认您的操作，并更新了指南进度。" },
  ms: { label: "PANDUAN BB", heading: "Bantu saya", page: "Tentang halaman ini", access: "Akses anda", next: "Langkah seterusnya", steps: "Langkah berpandu", complete: "Tandakan langkah selesai", done: "Selesai", open: "Buka bahagian ini", tutorials: "Semua tutorial", close: "Tutup Panduan BB", language: "Bahasa panduan", progress: "Kemajuan panduan", success: "Aplikasi mengesahkan tindakan anda. Kemajuan panduan telah dikemas kini." },
} satisfies Record<GuideLanguage, Record<string, string>>;
