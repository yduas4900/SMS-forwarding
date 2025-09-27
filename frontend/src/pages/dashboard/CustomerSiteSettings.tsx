// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Select,
  message,
  Row,
  Col,
  Typography,
  Divider,
  Space,
  Alert,
  Tabs,
  Upload,
  ColorPicker,
  Spin,
  Modal,
  Slider
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  EyeOutlined,
  UploadOutlined,
  BgColorsOutlined,
  EditOutlined,
  PictureOutlined,
  FontColorsOutlined,
  FontSizeOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined
} from '@ant-design/icons';
import axios from 'axios';
import WysiwygEditor from '../../components/WysiwygEditor';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface CustomerSiteSettings {
  customerSiteTitle: string;
  customerSiteDescription: string;
  customerSiteWelcomeText: string;
  customerSiteFooterText: string;
  customerSiteBackgroundColor: string;
  customerSiteLogoUrl?: string;
  customerSiteCustomCSS: string;
  enableCustomerSiteCustomization: boolean;
}

const CustomerSiteSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [settings, setSettings] = useState<CustomerSiteSettings>({
    customerSiteTitle: '验证码获取服务',
    customerSiteDescription: '安全便捷的验证码获取服务',
    customerSiteWelcomeText: '<h2>欢迎使用验证码获取服务</h2><p>请按照以下步骤获取您的验证码：</p><ol><li>复制用户名和密码</li><li>点击获取验证码按钮</li><li>等待验证码到达</li></ol>',
    customerSiteFooterText: '<p>如有问题，请联系客服。</p>',
    customerSiteBackgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    customerSiteLogoUrl: '',
    customerSiteCustomCSS: '',
    enableCustomerSiteCustomization: true
  });

  // 获取客户端设置
  const fetchSettings = async () => {
    try {
      setInitialLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/settings/customer-site', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        const fetchedSettings = response.data.data;
        setSettings(fetchedSettings);
        form.setFieldsValue(fetchedSettings);
      }
    } catch (error) {
      console.log('获取客户端设置失败，使用默认设置:', error);
      form.setFieldsValue(settings);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // 保存设置
  const handleSave = async (values: CustomerSiteSettings) => {
    console.log('🔄 开始保存客户端设置:', values);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      console.log('🔑 使用Token:', token ? '已获取' : '未获取');
      
      console.log('📤 发送API请求到: /api/settings/customer-site');
      const response = await axios.post('/api/settings/customer-site', values, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📥 API响应:', response.data);
      
      if (response.data.success) {
        setSettings(values);
        message.success('客户端设置保存成功！');
        console.log('✅ 设置保存成功');
      } else {
        console.error('❌ 保存失败:', response.data.message);
        message.error(response.data.message || '保存失败，请重试');
      }
    } catch (error) {
      console.error('❌ 保存客户端设置失败:', error);
      console.error('错误详情:', error.response?.data);
      console.error('错误状态码:', error.response?.status);
      
      if (error.response?.status === 401) {
        message.error('登录已过期，请重新登录');
      } else if (error.response?.status === 403) {
        message.error('权限不足，无法修改客户端设置');
      } else if (error.response?.status === 404) {
        message.error('API端点不存在，请检查后端配置');
      } else {
        message.error('保存失败，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 添加按钮点击处理函数
  const handleSaveButtonClick = () => {
    console.log('🖱️ 保存按钮被点击');
    form.submit(); // 手动触发表单提交
  };

  // 重置设置
  const handleReset = () => {
    form.resetFields();
    message.success('设置已重置');
  };

  // 预览功能
  const handlePreview = () => {
    const currentValues = form.getFieldsValue();
    setPreviewVisible(true);
    // 这里可以打开一个新窗口或模态框来预览客户端页面
    message.info('预览功能开发中...');
  };

  // 富文本编辑器状态
  const [imageUploadModal, setImageUploadModal] = useState(false);
  const [colorPickerModal, setColorPickerModal] = useState(false);
  const [currentTextAreaId, setCurrentTextAreaId] = useState('');
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Arial');

  // 图片上传处理
  const handleImageUpload = async (file: any) => {
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/images/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        const imageUrl = response.data.data.url;
        insertHtmlTag('img', currentTextAreaId, { imageUrl });
        message.success('图片上传成功！');
        setImageUploadModal(false);
      } else {
        message.error('图片上传失败');
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      message.error('图片上传失败，请重试');
    }
    
    return false; // 阻止默认上传行为
  };

  // 🔥 修复：增强的HTML编辑器工具栏 - 完全重写
  const insertHtmlTag = (tag: string, textAreaId: string, options: any = {}) => {
    console.log('🔧 插入HTML标签:', { tag, textAreaId, options });
    
    const textArea = document.getElementById(textAreaId) as HTMLTextAreaElement;
    if (!textArea) {
      console.error('❌ 找不到文本框:', textAreaId);
      return;
    }

    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const selectedText = textArea.value.substring(start, end);
    const currentValue = textArea.value;
    
    console.log('📝 当前选中文本:', selectedText);
    console.log('📄 当前文本框内容长度:', currentValue.length);
    
    let insertText = '';
    switch (tag) {
      case 'h1':
        insertText = selectedText ? 
          `<h1 style="color: ${selectedColor}; font-family: ${fontFamily};">${selectedText}</h1>` :
          `<h1 style="color: ${selectedColor}; font-family: ${fontFamily};">主标题</h1>`;
        break;
      case 'h2':
        insertText = selectedText ? 
          `<h2 style="color: ${selectedColor}; font-family: ${fontFamily};">${selectedText}</h2>` :
          `<h2 style="color: ${selectedColor}; font-family: ${fontFamily};">副标题</h2>`;
        break;
      case 'h3':
        insertText = selectedText ? 
          `<h3 style="color: ${selectedColor}; font-family: ${fontFamily};">${selectedText}</h3>` :
          `<h3 style="color: ${selectedColor}; font-family: ${fontFamily};">小标题</h3>`;
        break;
      case 'p':
        insertText = selectedText ? 
          `<p style="color: ${selectedColor}; font-size: ${fontSize}px; font-family: ${fontFamily};">${selectedText}</p>` :
          `<p style="color: ${selectedColor}; font-size: ${fontSize}px; font-family: ${fontFamily};">段落文本</p>`;
        break;
      case 'strong':
        insertText = selectedText ? 
          `<strong style="color: ${selectedColor};">${selectedText}</strong>` :
          `<strong style="color: ${selectedColor};">粗体文本</strong>`;
        break;
      case 'em':
        insertText = selectedText ? 
          `<em style="color: ${selectedColor};">${selectedText}</em>` :
          `<em style="color: ${selectedColor};">斜体文本</em>`;
        break;
      case 'u':
        insertText = selectedText ? 
          `<u style="color: ${selectedColor};">${selectedText}</u>` :
          `<u style="color: ${selectedColor};">下划线文本</u>`;
        break;
      case 'ul':
        insertText = selectedText ? 
          `<ul style="color: ${selectedColor};"><li>${selectedText}</li></ul>` :
          `<ul style="color: ${selectedColor};"><li>列表项1</li><li>列表项2</li></ul>`;
        break;
      case 'ol':
        insertText = selectedText ? 
          `<ol style="color: ${selectedColor};"><li>${selectedText}</li></ol>` :
          `<ol style="color: ${selectedColor};"><li>列表项1</li><li>列表项2</li></ol>`;
        break;
      case 'center':
        insertText = selectedText ? 
          `<div style="text-align: center; color: ${selectedColor};">${selectedText}</div>` :
          `<div style="text-align: center; color: ${selectedColor};">居中文本</div>`;
        break;
      case 'left':
        insertText = selectedText ? 
          `<div style="text-align: left; color: ${selectedColor};">${selectedText}</div>` :
          `<div style="text-align: left; color: ${selectedColor};">左对齐文本</div>`;
        break;
      case 'right':
        insertText = selectedText ? 
          `<div style="text-align: right; color: ${selectedColor};">${selectedText}</div>` :
          `<div style="text-align: right; color: ${selectedColor};">右对齐文本</div>`;
        break;
      case 'img':
        if (options.imageUrl) {
          insertText = `<img src="${options.imageUrl}" alt="上传的图片" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0;" />`;
        }
        break;
      case 'link':
        const url = prompt('请输入链接地址:');
        if (url) {
          insertText = selectedText ? 
            `<a href="${url}" style="color: ${selectedColor};" target="_blank">${selectedText}</a>` :
            `<a href="${url}" style="color: ${selectedColor};" target="_blank">链接文本</a>`;
        }
        break;
      case 'br':
        insertText = '<br>\n';
        break;
      case 'hr':
        insertText = '<hr style="border: 1px solid #ddd; margin: 20px 0;">\n';
        break;
      default:
        insertText = selectedText;
    }
    
    if (insertText) {
      // 🔥 关键修复：正确更新文本框内容和表单值
      const newValue = currentValue.substring(0, start) + insertText + currentValue.substring(end);
      
      console.log('🔄 更新后的内容:', newValue.substring(0, 100) + '...');
      
      // 1. 直接更新文本框的值
      textArea.value = newValue;
      
      // 2. 触发change事件，让React知道值已改变
      const event = new Event('input', { bubbles: true });
      textArea.dispatchEvent(event);
      
      // 3. 更新表单值
      const fieldName = textAreaId.replace('textarea-', '');
      form.setFieldsValue({ [fieldName]: newValue });
      
      // 4. 设置光标位置到插入内容的末尾
      const newCursorPos = start + insertText.length;
      setTimeout(() => {
        textArea.setSelectionRange(newCursorPos, newCursorPos);
        textArea.focus();
      }, 10);
      
      console.log('✅ HTML标签插入成功');
      message.success(`已插入${tag}标签`);
    }
  };

  // 增强的HTML编辑工具栏组件
  const EnhancedHtmlToolbar: React.FC<{ textAreaId: string }> = ({ textAreaId }) => (
    <div style={{ 
      marginBottom: 8, 
      padding: '12px', 
      background: '#fafafa', 
      border: '1px solid #d9d9d9',
      borderRadius: '6px 6px 0 0',
      borderBottom: 'none'
    }}>
      {/* 第一行：标题和格式 */}
      <div style={{ marginBottom: 8 }}>
        <Space size="small" wrap>
          <Button size="small" icon={<FontSizeOutlined />} onClick={() => insertHtmlTag('h1', textAreaId)}>H1</Button>
          <Button size="small" icon={<FontSizeOutlined />} onClick={() => insertHtmlTag('h2', textAreaId)}>H2</Button>
          <Button size="small" icon={<FontSizeOutlined />} onClick={() => insertHtmlTag('h3', textAreaId)}>H3</Button>
          <Button size="small" onClick={() => insertHtmlTag('p', textAreaId)}>段落</Button>
          <Divider type="vertical" />
          <Button size="small" icon={<BoldOutlined />} onClick={() => insertHtmlTag('strong', textAreaId)}>粗体</Button>
          <Button size="small" icon={<ItalicOutlined />} onClick={() => insertHtmlTag('em', textAreaId)}>斜体</Button>
          <Button size="small" icon={<UnderlineOutlined />} onClick={() => insertHtmlTag('u', textAreaId)}>下划线</Button>
        </Space>
      </div>

      {/* 第二行：对齐和列表 */}
      <div style={{ marginBottom: 8 }}>
        <Space size="small" wrap>
          <Button size="small" icon={<AlignLeftOutlined />} onClick={() => insertHtmlTag('left', textAreaId)}>左对齐</Button>
          <Button size="small" icon={<AlignCenterOutlined />} onClick={() => insertHtmlTag('center', textAreaId)}>居中</Button>
          <Button size="small" icon={<AlignRightOutlined />} onClick={() => insertHtmlTag('right', textAreaId)}>右对齐</Button>
          <Divider type="vertical" />
          <Button size="small" onClick={() => insertHtmlTag('ul', textAreaId)}>无序列表</Button>
          <Button size="small" onClick={() => insertHtmlTag('ol', textAreaId)}>有序列表</Button>
          <Button size="small" onClick={() => insertHtmlTag('link', textAreaId)}>链接</Button>
        </Space>
      </div>

      {/* 第三行：颜色、字体和媒体 */}
      <div>
        <Space size="small" wrap>
          <ColorPicker
            value={selectedColor}
            onChange={(color) => setSelectedColor(color.toHexString())}
            size="small"
          >
            <Button size="small" icon={<FontColorsOutlined />}>
              文字颜色
            </Button>
          </ColorPicker>
          
          <Select
            size="small"
            value={fontFamily}
            onChange={setFontFamily}
            style={{ width: 120 }}
          >
            <Option value="Arial">Arial</Option>
            <Option value="Microsoft YaHei">微软雅黑</Option>
            <Option value="SimSun">宋体</Option>
            <Option value="SimHei">黑体</Option>
            <Option value="KaiTi">楷体</Option>
            <Option value="Georgia">Georgia</Option>
            <Option value="Times New Roman">Times</Option>
          </Select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12 }}>字号:</span>
            <Slider
              min={12}
              max={36}
              value={fontSize}
              onChange={setFontSize}
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
            <Button 
              size="small" 
              icon={<PictureOutlined />}
              onClick={() => setCurrentTextAreaId(textAreaId)}
            >
              插入图片
            </Button>
          </Upload>

          <Button size="small" onClick={() => insertHtmlTag('br', textAreaId)}>换行</Button>
          <Button size="small" onClick={() => insertHtmlTag('hr', textAreaId)}>分割线</Button>
          
          <Divider type="vertical" />
          
          <Button 
            size="small" 
            type="primary" 
            ghost
            onClick={() => {
              // 🔥 快速测试功能
              const testContent = `<h2 style="color: #1890ff; font-family: Microsoft YaHei;">测试标题</h2>
<p style="color: #333; font-size: 16px; font-family: Microsoft YaHei;">这是一段测试文本，用于验证富文本编辑器功能是否正常工作。</p>
<ul style="color: #666;">
  <li>测试列表项1</li>
  <li>测试列表项2</li>
</ul>
<div style="text-align: center; color: #52c41a;">居中的绿色文字</div>`;
              
              const textArea = document.getElementById(textAreaId) as HTMLTextAreaElement;
              if (textArea) {
                textArea.value = testContent;
                const event = new Event('input', { bubbles: true });
                textArea.dispatchEvent(event);
                const fieldName = textAreaId.replace('textarea-', '');
                form.setFieldsValue({ [fieldName]: testContent });
                message.success('已插入测试内容');
              }
            }}
          >
            插入测试内容
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

  if (initialLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>正在加载客户端设置...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0' }}>
      <Form
        form={form}
        layout="vertical"
        initialValues={settings}
        onFinish={handleSave}
      >
        {/* 基础设置 */}
        <Card 
          title={
            <span>
              <EditOutlined style={{ marginRight: 8 }} />
              基础设置
            </span>
          }
          style={{ marginBottom: 24 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customerSiteTitle"
                label="客户端页面标题"
                rules={[{ required: true, message: '请输入客户端页面标题' }]}
              >
                <Input placeholder="例如：验证码获取服务" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customerSiteDescription"
                label="客户端页面描述"
                rules={[{ required: true, message: '请输入客户端页面描述' }]}
              >
                <Input placeholder="例如：安全便捷的验证码获取服务" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="enableCustomerSiteCustomization"
            label="启用客户端自定义"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Card>

        {/* 内容设置 */}
        <Card 
          title="内容设置"
          style={{ marginBottom: 24 }}
        >
          <Form.Item
            name="customerSiteWelcomeText"
            label="欢迎文本（所见即所得编辑器）"
            extra="真正的富文本编辑器，直接显示格式效果，不显示HTML代码"
          >
            <WysiwygEditor
              height={300}
              placeholder="输入欢迎文本，直接看到格式效果..."
            />
          </Form.Item>

          <Form.Item
            name="customerSiteFooterText"
            label="页脚文本（所见即所得编辑器）"
            extra="真正的富文本编辑器，直接显示格式效果，不显示HTML代码"
          >
            <WysiwygEditor
              height={200}
              placeholder="输入页脚文本，直接看到格式效果..."
            />
          </Form.Item>
        </Card>

        {/* 样式设置 */}
        <Card 
          title={
            <span>
              <BgColorsOutlined style={{ marginRight: 8 }} />
              样式设置
            </span>
          }
          style={{ marginBottom: 24 }}
        >
          <Form.Item
            name="customerSiteBackgroundColor"
            label="背景颜色/渐变"
            extra="支持CSS颜色值、渐变等，例如：#ffffff 或 linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          >
            <Input placeholder="例如：linear-gradient(135deg, #667eea 0%, #764ba2 100%)" />
          </Form.Item>

          <Form.Item
            name="customerSiteLogoUrl"
            label="Logo URL"
            extra="客户端页面Logo图片的URL地址"
          >
            <Input placeholder="例如：https://example.com/logo.png" />
          </Form.Item>

          <Form.Item
            name="customerSiteCustomCSS"
            label="自定义CSS"
            extra="高级用户可以添加自定义CSS样式"
          >
            <TextArea
              rows={8}
              placeholder="输入自定义CSS代码..."
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Card>

        <Alert
          message="提示"
          description="修改客户端设置后，所有客户访问链接的页面外观都会更新。建议先预览效果再保存。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form.Item>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveButtonClick}
              loading={loading}
              size="large"
            >
              保存设置
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
              size="large"
            >
              重置
            </Button>
            <Button
              icon={<EyeOutlined />}
              onClick={handlePreview}
              size="large"
            >
              预览效果
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
};

export default CustomerSiteSettings;
