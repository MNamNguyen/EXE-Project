// ISO (UTC) → giá trị cho <input type="datetime-local"> theo giờ ĐỊA PHƯƠNG.
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// Giá trị datetime-local (giờ địa phương) → ISO có timezone offset để gửi lên server.
export function localInputToISO(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
