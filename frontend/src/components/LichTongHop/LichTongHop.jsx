import React, { useState } from 'react';
import LapLichCongTac from '../LichCongTac/LapLichCongTac';
import LapLichTrucBan from '../LichTrucBan/LapLichTrucBan';
import XuatLich from '../XuatLich/XuatLich';
import { X } from 'lucide-react';

const TABS = [
  { id: 'congtac', label: 'Lịch sự kiện' },
  { id: 'trucban', label: 'Lịch trực ban' },
];

const SPECIAL_DUTY_DEPARTMENTS = ['Phòng hành chính tổng hợp', 'Đội lái xe', 'Đội bệnh xá'];

const LichTongHop = (props) => {
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('lichTongHopActiveTab') || 'congtac');
  const [showExportModal, setShowExportModal] = useState(false);

  React.useEffect(() => {
    sessionStorage.setItem('lichTongHopActiveTab', activeTab);
  }, [activeTab]);

  const isSpecialDutyManager = props.user?.role === 'Quản lý' && SPECIAL_DUTY_DEPARTMENTS.includes(String(props.user?.department || '').trim());
  const canEditDuty = props.user?.backendRole === 'superadmin' || isSpecialDutyManager || Boolean(props.user?.canManageDutySchedules) || Boolean(props.user?.canManageDutySchedulesByDepartment) || Boolean(props.user?.canManageDutySchedulesByPermission);

  const visibleTabs = TABS.filter(tab => {
    if (tab.id === 'trucban') return Boolean(canEditDuty);
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {visibleTabs.map((tab) => (
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
          onOpenExport={() => setShowExportModal(true)}
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

      {showExportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Xuất / In lịch</h3>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 p-1" title="Đóng">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <XuatLich
                variant="modal"
                xuatLichHistory={props.xuatLichHistory}
                reloadData={props.reloadData}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LichTongHop;
