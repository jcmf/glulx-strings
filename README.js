// Generated by CoffeeScript 1.9.0
(function() {
  var bytes, fs;

  exports.extract_strings = function(bytes, cb) {
    var code_addr, code_end, code_start, data_addr, data_end, data_start, decode_huffman, decode_u32, decode_u8, glulx_start, huffman_root, i, ram_start, string_table_end, string_table_size, string_table_start, u32, u8, wrapped_cb, _i, _j, _ref, _ref1, _ref2;
    if (bytes.length < 36) {
      return;
    }
    for (i = _i = 0, _ref = bytes.length - 36; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
      if (bytes[i] === 71 && bytes[i + 1] === 108 && bytes[i + 2] === 117 && bytes[i + 3] === 108 && bytes[i + 4] === 0) {
        glulx_start = i;
        break;
      }
    }
    if (glulx_start == null) {
      return;
    }
    u8 = function(addr) {
      return bytes[glulx_start + addr];
    };
    u32 = function(addr) {
      return u8(addr) * 0x1000000 + u8(addr + 1) * 0x10000 + u8(addr + 2) * 0x100 + u8(addr + 3);
    };
    ram_start = u32(8);
    string_table_start = u32(28);
    string_table_size = u32(string_table_start);
    string_table_end = string_table_start + string_table_size;
    huffman_root = u32(string_table_start + 8);
    code_start = 36;
    code_end = string_table_start;
    data_start = string_table_end;
    data_end = Math.min(ram_start, bytes.length - glulx_start);
    decode_u8 = function(addr, cb) {
      var byte, chars;
      chars = [];
      while (true) {
        if (addr > data_end) {
          return;
        }
        byte = u8(addr);
        if (byte === 0) {
          return cb(chars.join(''));
        }
        chars.push(String.fromCharCode(byte));
        addr += 1;
      }
    };
    decode_u32 = function(addr, cb) {
      var chars, code_point;
      chars = [];
      while (true) {
        if (addr > data_end) {
          return;
        }
        code_point = u32(addr);
        if (code_point === 0) {
          return cb(chars.join(''));
        }
        chars.push(String.fromCharCode(code_point));
        addr += 4;
      }
    };
    decode_huffman = function(addr, cb) {
      var bit, bit_offset, pieces, tree_node;
      pieces = [];
      tree_node = huffman_root;
      bit_offset = -1;
      while (true) {
        bit_offset += 1;
        if (bit_offset === 8) {
          bit_offset = 0;
          addr += 1;
        }
        bit = (u8(addr) >> bit_offset) & 1;
        assert(u8(tree_node) === 0);
        tree_node = u32(tree_node + 1 + 4 * bit);
        switch (u8(tree_node)) {
          case 0:
            continue;
          case 1:
            return cb(pieces.join(''));
          case 2:
            pieces.push(String.fromCharCode(u8(tree_node + 1)));
            break;
          case 3:
            decode_u8(tree_node + 1, s(function() {
              return pieces.push(s);
            }));
            break;
          case 4:
            pieces.push(String.fromCharCode(u32(tree_node + 1)));
            break;
          case 5:
            decode_u32(tree_node + 1, s(function() {
              return pieces.push(s);
            }));
            break;
          default:
            cb(pieces.join(''));
            pieces = [];
        }
        tree_node = huffman_root;
      }
    };
    for (code_addr = _j = code_start; code_start <= code_end ? _j < code_end : _j > code_end; code_addr = code_start <= code_end ? ++_j : --_j) {
      data_addr = u32(code_addr);
      if ((!data_start <= data_addr && data_addr < data_end)) {
        continue;
      }
      wrapped_cb = function(s) {
        if (s) {
          return cb(s, data_addr, code_addr);
        }
      };
      switch (u8(data_addr)) {
        case 0xe0:
          decode_u8(data_addr + 1, wrapped_cb);
          break;
        case 0xe1:
          decode_huffman(data_addr + 1, wrapped_cb);
          break;
        case 0xe2:
          if (((0 === (_ref2 = u8(data_addr + 1)) && _ref2 === (_ref1 = u8(data_addr + 2))) && _ref1 === u8(data_addr + 3))) {
            decode_u32(data + addr + 4, wrapped_cb);
          }
      }
    }
  };

  if ((typeof module !== "undefined" && module !== null) && module === (typeof require !== "undefined" && require !== null ? require.main : void 0)) {
    fs = require('fs');
    bytes = fs.readFileSync(process.argv[2]);
    exports.extract_strings(bytes, function(s) {
      return console.log(s);
    });
  }

}).call(this);