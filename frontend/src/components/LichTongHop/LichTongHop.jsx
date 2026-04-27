import React, { useState } from 'react';
import LapLichCongTac from '../LichCongTac/LapLichCongTac';
import LapLichTrucBan from '../LichTrucBan/LapLichTrucBan';
import XuatLich from '../XuatLich/XuatLich';

const TABS = [
  { id: 'congtac', label: 'Lịch công tác' },
  { id: 'trucban', label: 'Lịch trực ban' },
  { id: 'xuatin', label: 'Xuất / In lịch' },
];

const LichTongHop = (props) => {
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('lichTongHopActiveTab') || 'congtac');

  React.useEffect(() => {
    sessionStorage.setItem('lichTongHopActiveTab', activeTab);
  }, [activeTab]);

  return (
    <div className="space-y-4">
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'congtac' && (
        <LapLichCongTac
          user={props.user}
          lichCongTacData={props.lichCongTacData}
          canBoData={props.canBoData}
          departmentData={props.departmentData}
          holidayData={props.holidayData}
          reloadData={props.reloadData}
        />
      )}

      {activeTab === 'trucban' && (
        <LapLichTrucBan
          user={props.user}
          lichTrucBanData={props.lichTrucBanData}
          canBoData={props.canBoData}
          holidayData={props.holidayData}
          reloadData={props.reloadData}
        />
      )}

      {activeTab === 'xuatin' && (
        <XuatLich
          xuatLichHistory={props.xuatLichHistory}
          reloadData={props.reloadData}
        />
      )}
    </div>
  );
};

export default LichTongHop;
