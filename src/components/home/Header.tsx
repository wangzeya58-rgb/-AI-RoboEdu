export default function HomeHeader() {
  return (
    <header className="px-12 pt-12 pb-8">
      <h2 className="text-3xl font-bold" style={{ color: '#151E2B' }}>
        欢迎开启AI智能小车深度学习之旅
      </h2>
      <div className="flex gap-4 mt-6">
        <button
          className="px-6 py-2.5 rounded-lg font-medium text-sm transition-all hover:opacity-90"
          style={{ backgroundColor: '#2386FF', color: 'white' }}
        >
          查看指引
        </button>
        <button
          className="px-6 py-2.5 rounded-lg font-medium text-sm border transition-all hover:bg-opacity-5"
          style={{ borderColor: '#D1D5DB', color: '#374151', backgroundColor: 'white' }}
        >
          帮助中心
        </button>
      </div>
    </header>
  );
}
