import {
  AlignLeft, ArrowDown, ArrowUp, AtSign, CircleDot, ListChecks, Phone, Plus, Trash2,
} from 'lucide-react';
import Button, { IconButton } from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import { Input, Textarea } from '../../../components/ui/Input';
import { Checkbox } from '../../../components/ui/Choice';
import Dropdown, { MenuGroup, MenuItem, MenuLabel, MenuSeparator } from '../../../components/ui/Dropdown';

// Soạn danh sách trường của form check-in công khai. Họ tên luôn có (không nằm trong
// danh sách). Kiểu và giới hạn trùng khớp lib/publicForm.js ở backend — backend kiểm
// tra lại khi lưu. locked: đã có người check-in → chỉ xem.

export const FIELD_TYPE_META = {
  TEXT: { label: 'Chữ', icon: AlignLeft },
  PHONE: { label: 'Số điện thoại', icon: Phone },
  EMAIL: { label: 'Email', icon: AtSign },
  SINGLE: { label: 'Chọn một', icon: CircleDot },
  MULTI: { label: 'Chọn nhiều', icon: ListChecks },
};
const UNIQUE_TYPES = ['TEXT', 'PHONE', 'EMAIL'];
const CHOICE_TYPES = ['SINGLE', 'MULTI'];

// Trường có sẵn hay dùng — chỉ là mẫu điền sẵn tên + kiểu, BTC sửa tiếp được.
const PRESETS = [
  { label: 'Số điện thoại', type: 'PHONE', unique: true },
  { label: 'Email', type: 'EMAIL', unique: false },
  { label: 'Mã số sinh viên', type: 'TEXT', unique: true },
  { label: 'Trường / Đơn vị', type: 'TEXT', unique: false },
  { label: 'Chức vụ', type: 'TEXT', unique: false },
];
const CUSTOM = [
  { label: '', type: 'TEXT', menu: 'Câu hỏi dạng chữ' },
  { label: '', type: 'SINGLE', menu: 'Câu hỏi chọn một', options: ['', ''] },
  { label: '', type: 'MULTI', menu: 'Câu hỏi chọn nhiều', options: ['', ''] },
];

const newId = () => `f_${Math.random().toString(16).slice(2, 10)}`;

export function formFieldsError(fields) {
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!f.label.trim()) return `Trường ${i + 1}: chưa nhập tên trường`;
    if (CHOICE_TYPES.includes(f.type) && (f.options || []).filter((o) => o.trim()).length < 2) {
      return `Trường ${i + 1} (${f.label}): cần ít nhất 2 lựa chọn`;
    }
  }
  return null;
}

export default function PublicFormEditor({ fields, onChange, locked = false }) {
  const update = (idx, patch) => onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  const remove = (idx) => onChange(fields.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= fields.length) return;
    const next = [...fields];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
  };
  const add = ({ label, type, unique = false, options }) => onChange([
    ...fields,
    { id: newId(), type, label, required: true, unique, ...(options && { options: [...options] }) },
  ]);
  const changeType = (idx, type) => {
    const f = fields[idx];
    update(idx, {
      type,
      unique: UNIQUE_TYPES.includes(type) ? f.unique : false,
      options: CHOICE_TYPES.includes(type) ? (f.options?.length ? f.options : ['', '']) : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl bg-background p-3 text-sm">
        <span className="w-6 shrink-0 font-medium tabular-nums text-muted">·</span>
        <span className="font-medium text-foreground">Họ và tên</span>
        <span className="text-muted">— luôn có, bắt buộc</span>
      </div>

      {fields.map((f, idx) => (
        <div key={f.id} className="flex flex-col gap-3 rounded-xl bg-background p-3">
          <div className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-sm font-medium tabular-nums text-muted">{idx + 1}.</span>
            <Select
              inline
              size="sm"
              aria-label={`Kiểu trường ${idx + 1}`}
              value={f.type}
              disabled={locked}
              onChange={(type) => changeType(idx, type)}
              options={Object.entries(FIELD_TYPE_META).map(([value, m]) => ({ value, label: m.label }))}
            />
            <div className="flex-1" />
            <IconButton icon={ArrowUp} label="Lên trên" disabled={locked || idx === 0} onClick={() => move(idx, -1)} />
            <IconButton icon={ArrowDown} label="Xuống dưới" disabled={locked || idx === fields.length - 1} onClick={() => move(idx, 1)} />
            <IconButton icon={Trash2} label="Xoá trường" danger disabled={locked} onClick={() => remove(idx)} />
          </div>
          <Input
            aria-label={`Tên trường ${idx + 1}`}
            maxLength={200}
            disabled={locked}
            placeholder={CHOICE_TYPES.includes(f.type) ? 'VD: Bạn biết sự kiện qua đâu?' : 'VD: Trường / Đơn vị'}
            value={f.label}
            onChange={(e) => update(idx, { label: e.target.value })}
          />
          {CHOICE_TYPES.includes(f.type) && (
            <Textarea
              aria-label={`Các lựa chọn của trường ${idx + 1}`}
              rows={3}
              className="resize-y"
              disabled={locked}
              placeholder={'Mỗi dòng một lựa chọn\nVD: Facebook\nBạn bè giới thiệu'}
              value={(f.options || []).join('\n')}
              onChange={(e) => update(idx, { options: e.target.value.split('\n') })}
            />
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox small label="Bắt buộc" disabled={locked} checked={f.required} onChange={(e) => update(idx, { required: e.target.checked })} />
            {UNIQUE_TYPES.includes(f.type) && (
              <Checkbox
                small
                label="Chống trùng (mỗi giá trị chỉ check-in một lần)"
                disabled={locked}
                checked={f.unique}
                onChange={(e) => update(idx, { unique: e.target.checked })}
              />
            )}
          </div>
        </div>
      ))}

      {!locked && (
        <div>
          <Dropdown align="start" ariaLabel="Thêm trường" trigger={<Button size="sm" icon={Plus}>Thêm trường</Button>}>
            <MenuLabel>Trường có sẵn</MenuLabel>
            <MenuGroup>
              {PRESETS.map((p) => (
                <MenuItem key={p.label} icon={FIELD_TYPE_META[p.type].icon} onSelect={() => add(p)}>{p.label}</MenuItem>
              ))}
            </MenuGroup>
            <MenuSeparator />
            <MenuLabel>Câu hỏi riêng</MenuLabel>
            <MenuGroup>
              {CUSTOM.map((c) => (
                <MenuItem key={c.type} icon={FIELD_TYPE_META[c.type].icon} onSelect={() => add(c)}>{c.menu}</MenuItem>
              ))}
            </MenuGroup>
          </Dropdown>
        </div>
      )}
    </div>
  );
}
