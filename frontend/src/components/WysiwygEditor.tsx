// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  Select,
  ColorPicker,
  Slider,
  Space,
  Divider,
  Upload,
  message
} from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  PictureOutlined,
  LinkOutlined,
  FontColorsOutlined,
  FontSizeOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;

interface WysiwygEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
}

const WysiwygEditor: React.FC<WysiwygEditorProps> = ({
  value = '',
  onChange,
  placeholder = '请输入内容...',
  height = 300
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Microsoft YaHei');

  // 初始化编辑器内容
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // 执行富文本命令
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    handleContentChange();
  };

  // 处理内容变化
  const handleContentChange = () => {
    if (editorRef.current && onChange) {
      const content = editorRef.current.innerHTML;
      onChange(content);
    }
  };

  // 插入HTML内容
  const insertHTML = (html: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, html);
      handleContentChange();
    }
  };

  // 设置字体大小
  const setFontSizeCommand = (size: number) => {
    setFontSize(size);
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('fontSize', false, '7'); // 使用最大字号
      // 然后用CSS覆盖
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontSize = `${size}px`;
        span.style.fontFamily = fontFamily;
        try {
          range.surroundContents(span);
        } catch (e) {
          span.appendChild(range.extractContents());
          range.insertNode(span);
        }
        selection.removeAllRanges();
        handleContentChange();
      }
    }
  };

  // 设置字体
  const setFontFamilyCommand = (family: string) => {
    setFontFamily(family);
    execCommand('fontName', family);
  };

  // 设置文字颜色
  const setTextColor = (color: string) => {
    setSelectedColor(color);
    execCommand('foreColor', color);
  };

  // 图片上传
  const handleImageUpload = async (file: any) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/images/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        const imageUrl = response.data.data.url;
        insertHTML(`<img src="${imageUrl}" alt="上传的图片" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0;" />`);
        message.success('图片上传成功！');
      } else {
        message.error('图片上传失败');
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      message.error('图片上传失败，请重试');
    }
    
    return false;
  };

  // 插入链接
  const insertLink = () => {
    const url = prompt('请输入链接地址:');
    if (url) {
      const selection = window.getSelection();
      const selectedText = selection?.toString() || '链接文本';
      insertHTML(`<a href="${url}" target="_blank" style="color: ${selectedColor};">${selectedText}</a>`);
    }
  };

  // 工具栏组件
  const Toolbar = () => (
    <div style={{
      padding: '12px',
      background: '#fafafa',
      border: '1px solid #d9d9d9',
      borderBottom: 'none',
      borderRadius: '6px 6px 0 0'
    }}>
      {/* 第一行：基础格式 */}
      <div style={{ marginBottom: 8 }}>
        <Space size="small" wrap>
          <Button
            size="small"
            icon={<BoldOutlined />}
            onClick={() => execCommand('bold')}
          >
            粗体
          </Button>
          <Button
            size="small"
            icon={<ItalicOutlined />}
            onClick={() => execCommand('italic')}
          >
            斜体
          </Button>
          <Button
            size="small"
            icon={<UnderlineOutlined />}
            onClick={() => execCommand('underline')}
          >
            下划线
          </Button>
          
          <Divider type="vertical" />
          
          <Button
            size="small"
            onClick={() => execCommand('formatBlock', '<h1>')}
          >
            H1
          </Button>
          <Button
            size="small"
            onClick={() => execCommand('formatBlock', '<h2>')}
          >
            H2
          </Button>
          <Button
            size="small"
            onClick={() => execCommand('formatBlock', '<h3>')}
          >
            H3
          </Button>
          <Button
            size="small"
            onClick={() => execCommand('formatBlock', '<p>')}
          >
            段落
          </Button>
        </Space>
      </div>

      {/* 第二行：对齐和列表 */}
      <div style={{ marginBottom: 8 }}>
        <Space size="small" wrap>
          <Button
            size="small"
            icon={<AlignLeftOutlined />}
            onClick={() => execCommand('justifyLeft')}
          >
            左对齐
          </Button>
          <Button
            size="small"
            icon={<AlignCenterOutlined />}
            onClick={() => execCommand('justifyCenter')}
          >
            居中
          </Button>
          <Button
            size="small"
            icon={<AlignRightOutlined />}
            onClick={() => execCommand('justifyRight')}
          >
            右对齐
          </Button>
          
          <Divider type="vertical" />
          
          <Button
            size="small"
            icon={<UnorderedListOutlined />}
            onClick={() => execCommand('insertUnorderedList')}
          >
            无序列表
          </Button>
          <Button
            size="small"
            icon={<OrderedListOutlined />}
            onClick={() => execCommand('insertOrderedList')}
          >
            有序列表
          </Button>
          
          <Button
            size="small"
            icon={<LinkOutlined />}
            onClick={insertLink}
          >
            链接
          </Button>
        </Space>
      </div>

      {/* 第三行：样式控制 */}
      <div>
        <Space size="small" wrap>
          <ColorPicker
            value={selectedColor}
            onChange={(color) => setTextColor(color.toHexString())}
            size="small"
          >
            <Button size="small" icon={<FontColorsOutlined />}>
              文字颜色
            </Button>
          </ColorPicker>
          
          <Select
            size="small"
            value={fontFamily}
            onChange={setFontFamilyCommand}
            style={{ width: 120 }}
          >
            <Option value="Microsoft YaHei">微软雅黑</Option>
            <Option value="SimSun">宋体</Option>
            <Option value="SimHei">黑体</Option>
            <Option value="KaiTi">楷体</Option>
            <Option value="Arial">Arial</Option>
            <Option value="Georgia">Georgia</Option>
          </Select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12 }}>字号:</span>
            <Slider
              min={12}
              max={36}
              value={fontSize}
              onChange={setFontSizeCommand}
              style={{ width: 80 }}
            />
            <span style={{ fontSize: 12, minWidth: 30 }}>{fontSize}px</span>
          </div>

          <Divider type="vertical" />
          
          <Upload
            beforeUpload={handleImageUpload}
            showUploadList={false}
            accept="image/*"
          >
            <Button size="small" icon={<PictureOutlined />}>
              插入图片
            </Button>
          </Upload>

          <Button
            size="small"
            onClick={() => insertHTML('<br>')}
          >
            换行
          </Button>
          
          <Button
            size="small"
            onClick={() => insertHTML('<hr style="border: 1px solid #ddd; margin: 20px 0;">')}
          >
            分割线
          </Button>
        </Space>
      </div>

      {/* 样式预览 */}
      <div style={{
        marginTop: 8,
        padding: 8,
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 4,
        fontSize: 12
      }}>
        <span>当前样式预览: </span>
        <span style={{
          color: selectedColor,
          fontSize: `${fontSize}px`,
          fontFamily: fontFamily,
          fontWeight: 'bold'
        }}>
          示例文字 Sample Text
        </span>
      </div>
    </div>
  );

  return (
    <div>
      <Toolbar />
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleContentChange}
        onBlur={handleContentChange}
        style={{
          minHeight: height,
          padding: '12px',
          border: '1px solid #d9d9d9',
          borderRadius: '0 0 6px 6px',
          outline: 'none',
          fontSize: '14px',
          lineHeight: '1.6',
          fontFamily: 'Microsoft YaHei, sans-serif',
          backgroundColor: '#fff'
        }}
        placeholder={placeholder}
        onFocus={(e) => {
          if (e.target.innerHTML === '') {
            e.target.innerHTML = '';
          }
        }}
      />
    </div>
  );
};

export default WysiwygEditor;
