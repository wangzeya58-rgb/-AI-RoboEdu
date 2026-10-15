export default function CompetitionHeader() {
  return (
    <header
      className="px-12 pt-10 pb-8"
      style={{ background: 'linear-gradient(135deg, #2386FF 0%, #1E6FD8 100%)' }}
    >
      <h2 className="text-2xl font-bold text-white">AI小车竞赛赛事</h2>
      <p className="text-sm mt-1 text-white text-opacity-90">
        参与各类智能车竞赛，展示训练成果，争夺荣誉奖项
      </p>
      <div className="flex gap-3 mt-4">
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-white" style={{ color: '#2386FF' }}>
          赛事规则
        </button>
        <button className="px-4 py-2 rounded-lg text-sm font-medium border-2 border-white text-white">
          我要报名
        </button>
      </div>
    </header>
  );
}
