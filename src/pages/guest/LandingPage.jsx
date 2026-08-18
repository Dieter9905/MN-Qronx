import { Link } from 'react-router-dom'
import {
  ListChecks,
  BellRinging,
  ArrowsClockwise,
  CalendarBlank,
  Clock,
  CheckCircle,
  Lightning,
  CaretRight,
  DeviceMobile,
  Monitor,
  Globe,
  Plus,
  House,
  ChartBar,
  Gear,
  UserCirclePlus,
  Bell,
  Fire,
  ShieldCheck,
  Lock,
  Eye,
  Timer,
} from '@phosphor-icons/react'
import { Logo, LogoMark } from '../../components/Logo'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'

// ---------- GuestNav ----------
function GuestNav() {
  const { user } = useAuth()
  return (
    <header className="sticky top-0 z-40 border-b border-navy-100/60 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="MN-Qronx – Trang chủ">
          <Logo size={34} />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-navy-600 md:flex" aria-label="Điều hướng">
          <a href="#tinh-nang" className="transition hover:text-blue-600">Tính năng</a>
          <a href="#cach-hoat-dong" className="transition hover:text-blue-600">Cách hoạt động</a>
          <a href="#gioi-thieu" className="transition hover:text-blue-600">Giới thiệu</a>
          <a href="#lien-he" className="transition hover:text-blue-600">Liên hệ</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/app">
              <Button variant="gradient" size="sm" icon={CaretRight}>
                Vào ứng dụng
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm">Đăng nhập</Button>
              </Link>
              <Link to="/register">
                <Button variant="gradient" size="sm" icon={UserCirclePlus}>
                  Đăng ký
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// ---------- Hero ----------
function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-900 text-white">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden="true" />
      <div
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:pb-28 lg:pt-24">
        <div className="animate-slide-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300 ring-1 ring-inset ring-white/15">
            <Lightning size={14} weight="fill" />
            Nhắc nhở kiểu báo thức · Plan. Do. On Time.
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Quản lý thời gian.
            <br />
            <span className="bg-brand-gradient bg-clip-text text-transparent">Làm chủ công việc.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-navy-200">
            Lên kế hoạch, theo dõi, nhận nhắc nhở và hoàn thành mục tiêu đúng thời điểm. Khi đến giờ, MN-Qronx
            đổ chuông, rung và hiển thị báo thức toàn màn hình – bạn khó lòng bỏ lỡ một deadline nào.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/register">
              <Button variant="gradient" size="lg" icon={CaretRight} iconWeight="bold">
                Bắt đầu ngay
              </Button>
            </Link>
            <a href="#tinh-nang">
              <Button variant="light" size="lg">
                Xem tính năng
              </Button>
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-navy-300">
            <span className="flex items-center gap-1.5">
              <CheckCircle size={16} weight="fill" className="text-cyan-400" /> Miễn phí khi dùng thử
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle size={16} weight="fill" className="text-cyan-400" /> Đồng bộ Web & Mobile
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle size={16} weight="fill" className="text-cyan-400" /> Không cần thẻ tín dụng
            </span>
          </div>
        </div>

        {/* Hero visual – mô phỏng theo mockup */}
        <div className="relative mx-auto w-full max-w-md animate-slide-up" style={{ animationDelay: '120ms' }}>
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}

function HeroVisual() {
  const tasks = [
    { time: '09:00', title: 'Họp review sprint', color: '#8B5CF6', tag: 'Công việc' },
    { time: '14:30', title: 'Ôn tập môn Toán', color: '#2563EB', tag: 'Học tập' },
    { time: '19:00', title: 'Tập thể dục', color: '#06B6D4', tag: 'Cá nhân' },
  ]
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-brand-gradient opacity-20 blur-3xl" aria-hidden="true" />
      <div className="relative rounded-3xl bg-white/95 p-4 shadow-2xl ring-1 ring-white/40">
        {/* Thanh trình duyệt */}
        <div className="flex items-center gap-2 px-1 pb-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 flex-1 rounded-md bg-navy-50 px-3 py-1 text-[11px] font-medium text-navy-400">
            app.mn-qronx.com
          </span>
        </div>
        {/* Dashboard mini */}
        <div className="rounded-2xl bg-navy-50/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-navy-900">Xin chào, Minh! 👋</p>
              <p className="text-xs text-navy-400">Thứ Hai, 17 Tháng 8, 2026</p>
            </div>
            <span className="rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-bold text-white">
              5 · 3 ✅
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { n: '5', l: 'Công việc', c: 'text-blue-600' },
              { n: '3', l: 'Hoàn thành', c: 'text-emerald-600' },
              { n: '2', l: 'Còn lại', c: 'text-amber-600' },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-white p-2.5 text-center shadow-sm">
                <p className={`text-lg font-extrabold ${s.c}`}>{s.n}</p>
                <p className="text-[10px] font-semibold text-navy-400">{s.l}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-navy-400">Lịch trình hôm nay</p>
          <ul className="mt-2 space-y-1.5">
            {tasks.map((t, i) => (
              <li
                key={t.title}
                className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-sm"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg text-[9px] font-bold"
                  style={{ backgroundColor: `${t.color}1a`, color: t.color }}
                >
                  <Clock size={11} weight="bold" />
                  {t.time}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-navy-800">{t.title}</span>
                  <span className="block text-[10px] text-navy-400">{t.tag}</span>
                </span>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Card báo thức nổi */}
      <div
        className="absolute -right-4 -top-6 flex animate-float items-center gap-3 rounded-2xl bg-navy-900 p-3 text-white shadow-glow-purple ring-1 ring-white/20"
        style={{ animationDelay: '300ms' }}
      >
        <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient">
          <Bell size={18} weight="fill" />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-rose-400" />
        </span>
        <span>
          <span className="block text-xs font-bold">Đến giờ rồi!</span>
          <span className="block text-[10px] text-navy-300">Hoãn · Tắt</span>
        </span>
      </div>
    </div>
  )
}

// ---------- Tính năng ----------
const FEATURES = [
  {
    icon: ListChecks,
    color: 'text-blue-600 bg-blue-50',
    title: 'Quản lý công việc linh hoạt',
    desc: 'Tạo công việc kèm danh mục, mức ưu tiên, việc con và thời hạn. Lọc, tìm kiếm, lịch ngày/tuần/tháng trực quan.',
  },
  {
    icon: BellRinging,
    color: 'text-purple-600 bg-purple-50',
    title: 'Nhắc nhở kiểu báo thức',
    desc: 'Không chỉ thông báo thầm lặng: hệ thống đổ chuông, rung và hiển thị báo thức toàn màn hình cho đến khi bạn Hoãn hoặc Tắt.',
  },
  {
    icon: ArrowsClockwise,
    color: 'text-cyan-600 bg-cyan-50',
    title: 'Đồng bộ Web & Mobile',
    desc: 'Dữ liệu công việc đồng bộ thời gian thực giữa website và app Android/iOS – thay đổi ở nơi nào cũng thấy ở nơi khác.',
  },
  {
    icon: Clock,
    color: 'text-amber-600 bg-amber-50',
    title: 'Công việc lặp lại',
    desc: 'Hằng ngày, hằng tuần hay hằng tháng – MN-Qronx tự tạo bản sao kế tiếp khi bạn hoàn thành, không cần gõ lại.',
  },
  {
    icon: CheckCircle,
    color: 'text-emerald-600 bg-emerald-50',
    title: 'Dashboard cá nhân',
    desc: 'Biết ngay hôm nay có gì cần làm, cái gì quá hạn, đã hoàn thành bao nhiêu và sắp tới còn gì.',
  },
  {
    icon: Fire,
    color: 'text-rose-600 bg-rose-50',
    title: 'Lịch sử thông báo',
    desc: 'Mọi báo thức đã gửi, đã hoãn hay đã tắt đều được ghi lại để bạn kiểm tra khi cần.',
  },
]

function Features() {
  return (
    <section id="tinh-nang" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-purple">Tính năng</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
          Mọi thứ để bạn <span className="bg-brand-gradient bg-clip-text text-transparent">đúng thời điểm</span>
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-navy-500">
          Từ việc lên kế hoạch, theo dõi tiến độ đến cơ chế báo thức khó bỏ lỡ – MN-Qronx giữ bạn luôn đúng hẹn.
        </p>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <article
            key={f.title}
            className="card group p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${f.color}`}>
              <f.icon size={24} weight="duotone" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-navy-900 group-hover:text-blue-700">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-navy-500">{f.desc}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

// ---------- Cách hoạt động (báo thức) ----------
function HowItWorks() {
  const steps = [
    {
      icon: Plus,
      title: 'Tạo công việc',
      desc: 'Nhập tiêu đề, chọn danh mục, mức ưu tiên và thời điểm đến hạn. Thêm việc con và nhắc nhở ngay khi tạo.',
    },
    {
      icon: Timer,
      title: 'Thiết lập nhắc nhở',
      desc: 'Đặt một hoặc nhiều nhắc nhở: đúng giờ, trước 10 phút, trước 1 giờ… tối đa 5 nhắc nhở cho mỗi công việc.',
    },
    {
      icon: BellRinging,
      title: 'Báo thức đổ chuông',
      desc: 'Đến giờ, MN-Qronx phát âm thanh, rung và hiển thị màn hình báo thức toàn màn hình – không thể bỏ qua.',
    },
    {
      icon: CheckCircle,
      title: 'Hoãn hoặc Tắt',
      desc: 'Bận lúc đó? Chọn Hoãn để dời thêm vài phút (tối đa 3 lần). Đã nắm được? Chọn Tắt để xác nhận hoàn tất.',
    },
  ]
  return (
    <section id="cach-hoat-dong" className="relative overflow-hidden bg-white py-20 lg:py-28">
      <div className="absolute inset-0 bg-brand-gradient-soft" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-blue">Cách hoạt động</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
            Báo thức kiểu mới, <span className="bg-brand-gradient bg-clip-text text-transparent">khó bỏ lỡ</span>
          </h2>
          <p className="mt-4 text-lg text-navy-500">
            Khác với to-do thông thường, MN-Qronx buộc bạn xác nhận nhận biết công việc bằng nút Hoãn hoặc Tắt.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl bg-white p-6 shadow-card ring-1 ring-navy-100">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow-blue">
                  <s.icon size={22} weight="bold" />
                </span>
                <span className="text-3xl font-extrabold text-navy-100">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="mt-4 font-bold text-navy-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-500">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Màn hình báo thức demo */}
        <div className="mt-16 overflow-hidden rounded-3xl bg-navy-900 shadow-2xl ring-1 ring-navy-800">
          <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-300 ring-1 ring-inset ring-rose-500/30">
                <BellRinging size={13} weight="fill" /> Màn hình báo thức (SCR-U-07)
              </span>
              <h3 className="mt-4 text-2xl font-extrabold text-white sm:text-3xl">
                Khi đến giờ, màn hình <span className="text-cyan-300">nói chuyện với bạn</span>
              </h3>
              <p className="mt-3 leading-relaxed text-navy-200">
                Trên Web, báo thức hiện dạng overlay toàn trang; trên Mobile, nó có thể bật cả màn hình khóa.
                Không có nút back nào đóng được báo thức – chỉ có <strong>Hoãn</strong> hoặc <strong>Tắt</strong>.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-navy-200">
                {['Âm thanh chuông lặp lại đến khi xác nhận', 'Màu nền theo mức độ khẩn cấp của công việc', 'Hoãn tối đa 3 lần, mỗi lần theo cài đặt của bạn'].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle size={17} weight="fill" className="mt-0.5 shrink-0 text-cyan-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            {/* Mô phỏng điện thoại */}
            <div className="relative mx-auto w-full max-w-[260px]">
              <div className="rounded-[2.2rem] bg-navy-950 p-2.5 shadow-2xl ring-1 ring-white/10">
                <div className="relative overflow-hidden rounded-[1.7rem] bg-alarm-gradient px-5 pb-6 pt-10">
                  <div className="mx-auto h-1 w-16 rounded-full bg-white/25" />
                  <div className="mt-8 flex flex-col items-center text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                      <BellRinging size={26} weight="fill" className="animate-alarm-bell text-cyan-300" />
                    </span>
                    <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">Hôm nay · 17:30</p>
                    <p className="mt-2 text-base font-extrabold leading-snug text-white">Nộp báo cáo tuần cho nhóm</p>
                    <span className="mt-3 rounded-full bg-purple-400/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-200 ring-1 ring-inset ring-purple-400/30">
                      Công việc · Ưu tiên cao
                    </span>
                  </div>
                  <div className="mt-8 grid grid-cols-2 gap-2">
                    <span className="flex h-11 items-center justify-center rounded-xl bg-white/15 text-xs font-bold text-white ring-1 ring-white/20">
                      Hoãn 10 phút
                    </span>
                    <span className="flex h-11 items-center justify-center rounded-xl bg-white text-xs font-extrabold text-navy-900">
                      Tắt
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- Đồng bộ + Giới thiệu ----------
function SyncSection() {
  return (
    <section id="gioi-thieu" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="relative mx-auto max-w-sm">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-brand-gradient opacity-15 blur-2xl" aria-hidden="true" />
            <div className="relative rounded-3xl bg-white p-4 shadow-card-hover ring-1 ring-navy-100">
              <div className="rounded-2xl bg-navy-900 p-5 text-white">
                <Logo size={30} dark tagline />
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-navy-200">
                    <ArrowsClockwise size={14} className="text-cyan-300" weight="bold" /> Đồng bộ hai chiều Web ⇄ Mobile
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-navy-200">
                    <ShieldCheck size={14} className="text-cyan-300" weight="bold" /> Mỗi tài khoản một email duy nhất
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-navy-200">
                    <Lock size={14} className="text-cyan-300" weight="bold" /> Mật khẩu mã hóa, không lưu bản gốc
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-around py-4 text-navy-400">
                <Monitor size={26} weight="duotone" />
                <ArrowsClockwise size={20} weight="bold" className="text-brand-purple" />
                <DeviceMobile size={26} weight="duotone" />
                <ArrowsClockwise size={20} weight="bold" className="text-brand-purple" />
                <Globe size={26} weight="duotone" />
              </div>
            </div>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-cyan">Giới thiệu</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
            MN-Qronx – <span className="bg-brand-gradient bg-clip-text text-transparent">Qronx</span> nghĩa là gì?
          </h2>
          <p className="mt-4 leading-relaxed text-navy-500">
            <strong>Q</strong> là chữ cái của <em>Qronx</em> – trọng tâm thương hiệu, được cách điệu thành
            <strong> đồng hồ + dấu tích</strong>: quản lý thời gian và hoàn thành công việc.
          </p>
          <div className="mt-6 space-y-4">
            {[
              { icon: Clock, title: 'Đồng hồ', desc: 'Quản lý thời gian' },
              { icon: CheckCircle, title: 'Dấu tích', desc: 'Hoàn thành công việc' },
              { icon: Lightning, title: 'Đường chuyển động', desc: 'Nhanh chóng – hiệu quả' },
              { icon: LogoMark, title: 'Chữ Q', desc: 'Từ “Qronx” – trọng tâm thương hiệu' },
            ].map((s) => (
              <div key={s.title} className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gradient-soft ring-1 ring-blue-100">
                  {typeof s.icon === 'function' && s.icon === LogoMark ? (
                    <LogoMark size={26} />
                  ) : (
                    <s.icon size={22} weight="duotone" className="text-blue-600" />
                  )}
                </span>
                <div>
                  <p className="font-bold text-navy-900">{s.title}</p>
                  <p className="text-sm text-navy-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- CTA cuối ----------
function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-6 py-14 text-center text-white sm:px-12">
        <div className="absolute inset-0 bg-hero-glow" aria-hidden="true" />
        <div className="relative">
          <LogoMark size={52} withRing className="mx-auto" />
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Plan. Do. <span className="bg-brand-gradient bg-clip-text text-transparent">On Time.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-navy-200">
            “Lên kế hoạch – Bắt tay làm – Đúng thời điểm.” Hãy để MN-Qronx nhắc bạn đúng lúc, mỗi ngày.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <Button variant="gradient" size="lg" icon={CaretRight} iconWeight="bold">
                Đăng ký miễn phí
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="light" size="lg">
                Đăng nhập
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- Footer ----------
function Footer() {
  return (
    <footer id="lien-he" className="border-t border-navy-100 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo size={34} />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-navy-500">
              Ứng dụng quản lý thời gian & công việc cá nhân với nhắc nhở kiểu báo thức.
              Hoạt động trên Website và Mobile App (Android/iOS).
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" aria-hidden="true" /> PLAN · DO · ON TIME
            </div>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-navy-400">Sản phẩm</p>
            <ul className="mt-3 space-y-2 text-sm font-medium text-navy-600">
              <li><a href="#tinh-nang" className="transition hover:text-blue-600">Tính năng</a></li>
              <li><a href="#cach-hoat-dong" className="transition hover:text-blue-600">Cách hoạt động</a></li>
              <li><Link to="/register" className="transition hover:text-blue-600">Tạo tài khoản</Link></li>
              <li><Link to="/login" className="transition hover:text-blue-600">Đăng nhập</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-navy-400">Liên hệ</p>
            <ul className="mt-3 space-y-2 text-sm font-medium text-navy-600">
              <li>Email: support@mn-qronx.com</li>
              <li>Web: www.mn-qronx.com</li>
              <li className="flex items-center gap-1.5">
                <House size={15} weight="bold" className="text-brand-purple" /> Đồ án quản lý thời gian
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-navy-100 pt-6 text-xs text-navy-400 sm:flex-row">
          <p>© 2026 MN-Qronx. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <Lock size={13} weight="bold" /> Bảo mật theo chuẩn đồ án · JWT + HTTPS
          </p>
        </div>
      </div>
    </footer>
  )
}

// ---------- Page ----------
export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-white">
      <GuestNav />
      <Hero />
      <Features />
      <HowItWorks />
      <SyncSection />
      <FinalCta />
      <Footer />
    </div>
  )
}
