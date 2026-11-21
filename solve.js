// Fast CSV reader: an exact drop-in for csv-reader 1.0.0.
//
// Design: indexOf-driven scanning instead of the reference's one-character-at-a-time
// loop. An unquoted field is sliced between the next ',' / line break; a quoted
// field locates its closing quote with indexOf (skipping "" escapes) and takes its
// content as one slice. Stray CRs, "" and CRs inside quotes, and characters after
// a closing quote take a slow path that only runs on the rare broken rows.
//
// Semantics (csv-reader 1.0.0): a U+FEFF at the very start is dropped; a record
// ends at LF or CRLF and a line left with no characters is no record; outside
// quotes a CR not followed by LF is dropped (stray_cr); a field opening with a
// quote runs to the next quote that is not doubled, "" inside it is one quote and
// each CRLF or lone CR inside it is read as LF; what follows its closing quote,
// up to the next comma or line break, is appended as it stands (quote_junk, when
// the field ends); a quote that never closes is a literal character and the text
// after it is read again as unquoted (unterminated_quote); a quote inside an
// unquoted field is a literal character; fields stay strings. columns is the
// first record when header is true, else null; rows holds the records after it,
// each padded (short_row) or cut (long_row) to the first record's width. Each
// error is {code, line, row} in the order met: line the 1-based line its record
// starts on, row its record's index in rows (null for the header).

const LF = 10; // \n
const CR = 13; // \r
const COMMA = 44; // ,
const QUOTE = 34; // "

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  let text = input.text;
  if (typeof text !== 'string') text = String(text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xFEFF) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes.
  let recordLine = 1;
  let recordRow = null;

  // Read an unquoted field starting at `p`, with `prefix` already in the value.
  // Returns [value, ended]: ended 0 = comma, 1 = line break, 2 = end of text.
  // Advances pos and line; records stray_cr errors for the current record.
  function unquoted(prefix, p) {
    let value = prefix;
    let start = p;
    for (;;) {
      const cIdx = text.indexOf(',', start);
      const nIdx = text.indexOf('\n', start);
      let end;
      let kind;
      if (cIdx !== -1 && (nIdx === -1 || cIdx < nIdx)) {
        end = cIdx;
        kind = 0;
      } else if (nIdx !== -1) {
        end = nIdx;
        kind = 1;
      } else {
        end = n;
        kind = 2;
      }
      // Find a CR in [start, end). A CR at end - 1 when kind is 1 is the CRLF
      // of this line break; any other CR here is stray and dropped.
      let r = -1;
      for (let i = start; i < end; i++) {
        if (text.charCodeAt(i) === CR) {
          r = i;
          break;
        }
      }
      if (r === -1) {
        value += text.slice(start, end);
        if (kind === 0) {
          pos = end + 1;
          return [value, 0];
        }
        if (kind === 1) {
          pos = end + 1;
          line += 1;
          return [value, 1];
        }
        pos = end;
        return [value, 2];
      }
      if (kind === 1 && r === end - 1) {
        value += text.slice(start, r);
        pos = end + 1;
        line += 1;
        return [value, 1];
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      value += text.slice(start, r);
      start = r + 1;
    }
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === LF) {
        pos += 1;
        line += 1;
      } else if (c === CR && pos + 1 < n && text.charCodeAt(pos + 1) === LF) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;

    for (;;) {
      let value;
      let ended;
      if (text.charCodeAt(pos) === QUOTE) {
        quoted = true;
        const open = pos;
        const openLine = line;
        // The closing quote: the next quote that is not doubled.
        let q = text.indexOf('"', pos + 1);
        while (q !== -1 && text.charCodeAt(q + 1) === QUOTE) {
          q = text.indexOf('"', q + 2);
        }
        if (q === -1) {
          // The quote never closes: it is a literal character, and the text
          // after it is read again as unquoted.
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          const r = unquoted('"', pos);
          value = r[0];
          ended = r[1];
        } else {
          const content = text.slice(open + 1, q);
          let val;
          if (content.indexOf('\r') === -1 && content.indexOf('"') === -1) {
            val = content;
            let nl = 0;
            let idx = content.indexOf('\n');
            while (idx !== -1) {
              nl += 1;
              idx = content.indexOf('\n', idx + 1);
            }
            line += nl;
          } else {
            // Slow path: "" becomes one quote, each CRLF or lone CR one LF.
            let built = '';
            let nl = 0;
            let i = 0;
            const m = content.length;
            while (i < m) {
              const ch = content.charCodeAt(i);
              if (ch === QUOTE) {
                built += '"';
                i += 2;
              } else if (ch === CR) {
                built += '\n';
                nl += 1;
                i += i + 1 < m && content.charCodeAt(i + 1) === LF ? 2 : 1;
              } else {
                if (ch === LF) nl += 1;
                built += content[i];
                i += 1;
              }
            }
            val = built;
            line += nl;
          }
          pos = q + 1;
          if (pos >= n) {
            value = val;
            ended = 2;
          } else {
            const c = text.charCodeAt(pos);
            if (c === COMMA) {
              pos += 1;
              value = val;
              ended = 0;
            } else if (c === LF) {
              pos += 1;
              line += 1;
              value = val;
              ended = 1;
            } else if (c === CR && text.charCodeAt(pos + 1) === LF) {
              pos += 2;
              line += 1;
              value = val;
              ended = 1;
            } else {
              // What follows the closing quote is appended as it stands.
              const r = unquoted(val, pos);
              if (r[0].length > val.length) {
                errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
              }
              value = r[0];
              ended = r[1];
            }
          }
        }
      } else {
        quoted = false;
        const r = unquoted('', pos);
        value = r[0];
        ended = r[1];
      }
      fields.push(value);
      if (ended !== 0) break;
    }

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
