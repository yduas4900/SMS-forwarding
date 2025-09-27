// @ts-nocheck
import React, { useState, useEffect } from 'react';
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
  Spin
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  EyeOutlined,
  UploadOutlined,
  BgColorsOutlined,
  EditOutlined
} from '@ant-design/icons';
import axios from 'axios';

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
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/settings/customer-site', values, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setSettings(values);
        message.success('客户端设置保存成功！');
      } else {
        message.error(response.data.message || '保存失败，请重试');
      }
    } catch (error) {
      console.error('保存客户端设置失败:', error);
      if (error.response?.status === 401) {
        message.error('登录已过期，请重新登录');
      } else if (error.response?.status === 403) {
        message.error('权限不足，无法修改客户端设置');
      } else {
        message.error('保存失败，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
    }
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

  // HTML编辑器工具栏
  const insertHtmlTag = (tag: string, textAreaId: string) => {
    const textArea = document.getElementById(textAreaId) as HTMLTextAreaElement;
    if (textArea) {
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      const selectedText = textArea.value.substring(start, end);
      
      let insertText = '';
      switch (tag) {
        case 'h2':
          insertText = `<h2>${selectedText || '标题'}</h2>`;
          break;
        case 'p':
          insertText = `<p>${selectedText || '段落文本'}</p>`;
          break;
        case 'strong':
          insertText = `<strong>${selectedText || '粗体文本'}</strong>`;
          break;
        case 'em':
          insertText = `<em>${selectedText || '斜体文本'}</em>`;
          break;
        case 'ul':
          insertText = `<ul><li>${selectedText || '列表项'}</li></ul>`;
          break;
        case 'ol':
          insertText = `<ol><li>${selectedText || '列表项'}</li></ol>`;
          break;
        case 'br':
          insertText = '<br>';
          break;
        default:
          insertText = selectedText;
      }
      
      const newValue = textArea.value.substring(0, start) + insertText + textArea.value.substring(end);
      
      // 更新表单值
      const fieldName = textAreaId.replace('textarea-', '');
      form.setFieldsValue({ [fieldName]: newValue });
    }
  };

  // HTML编辑工具栏组件
  const HtmlToolbar: React.FC<{ textAreaId: string }> = ({ textAreaId }) => (
    <div style={{ 
      marginBottom: 8, 
      padding: '8px 12px', 
      background: '#fafafa', 
      border: '1px solid #d9d9d9',
      borderRadius: '6px 6px 0 0',
      borderBottom: 'none'
    }}>
      <Space size="small">
        <Button size="small" onClick={() => insertHtmlTag('h2', textAreaId)}>H2</Button>
        <Button size="small" onClick={() => insertHtmlTag('p', textAreaId)}>段落</Button>
        <Button size="small" onClick={() => insertHtmlTag('strong', textAreaId)}>粗体</Button>
        <Button size="small" onClick={() => insertHtmlTag('em', textAreaId)}>斜体</Button>
        <Button size="small" onClick={() => insertHtmlTag('ul', textAreaId)}>无序列表</Button>
        <Button size="small" onClick={() => insertHtmlTag('ol', textAreaId)}>有序列表</Button>
        <Button size="small" onClick={() => insertHtmlTag('br', textAreaId)}>换行</Button>
      </Space>
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
            label="欢迎文本（支持HTML）"
            extra="支持HTML标签，用于在客户端页面顶部显示欢迎信息"
          >
            <div>
              <HtmlToolbar textAreaId="textarea-customerSiteWelcomeText" />
              <TextArea
                id="textarea-customerSiteWelcomeText"
                rows={6}
                placeholder="输入欢迎文本，支持HTML标签"
                style={{ borderRadius: '0 0 6px 6px' }}
              />
            </div>
          </Form.Item>

          <Form.Item
            name="customerSiteFooterText"
            label="页脚文本（支持HTML）"
            extra="支持HTML标签，用于在客户端页面底部显示信息"
          >
            <div>
              <HtmlToolbar textAreaId="textarea-customerSiteFooterText" />
              <TextArea
                id="textarea-customerSiteFooterText"
                rows={4}
                placeholder="输入页脚文本，支持HTML标签"
                style={{ borderRadius: '0 0 6px 6px' }}
              />
            </div>
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
              htmlType="submit"
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
