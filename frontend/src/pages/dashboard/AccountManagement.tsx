import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  Input, 
  Space, 
  Tag, 
  Popconfirm, 
  message, 
  Modal,
  Form,
  Select,
  Upload,
  Typography,
  Row,
  Col,
  Image
} from 'antd';
import { 
  ReloadOutlined, 
  DeleteOutlined, 
  EditOutlined,
  PlusOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { accountAPI, serviceTypeAPI } from '../../services/api';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';

const { Title } = Typography;
const { TextArea } = Input;

interface Account {
  id: number;
  account_name: string;
  username: string;
  password: string;
  type: string;
  image_url: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  primary_device_id?: number;
  primary_device?: {
    id: number;
    device_id: string;
    brand: string;
    model: string;
    phone_number: string;
    is_online: boolean;
  };
}

interface AccountFormData {
  account_name: string;
  username: string;
  password: string;
  type: string;
  image_url?: string;
  description?: string;
  status: string;
  primary_device_id: number; // 新增：必须绑定设备
}

interface Device {
  id: number;
  device_id: string;
  brand: string;
  model: string;
  phone_number: string;
  is_online: boolean;
  status_text: string;
  status_color: string;
  last_active_text: string;
  bound_accounts_count?: number;
  bound_accounts?: Array<{id: number, account_name: string}>;
}

const AccountManagement: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 服务类型选项 - 从API动态获取
  const [serviceTypes, setServiceTypes] = useState<Array<{label: string, value: string, color?: string}>>([]);
  
  // 可用设备列表 - 从API动态获取
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  // 账号状态选项
  const statusOptions = [
    { label: '正常', value: 'active' },
    { label: '禁用', value: 'inactive' },
    { label: '暂停', value: 'suspended' },
  ];

  useEffect(() => {
    fetchAccounts();
    fetchServiceTypes();
  }, [pagination.current, pagination.pageSize, searchText]);

  // 获取可用设备列表
  const fetchAvailableDevices = async () => {
    try {
      setDevicesLoading(true);
      console.log('🔄 开始获取可用设备列表...');
      const response: any = await accountAPI.getAvailableDevices();
      console.log('📱 可用设备API响应:', response);
      
      if (response.success && response.data) {
        setAvailableDevices(response.data);
        console.log('✅ 成功获取可用设备:', response.data.length, '个');
      } else {
        console.warn('⚠️ 可用设备API响应格式异常:', response);
        message.warning('获取可用设备失败');
        setAvailableDevices([]);
      }
    } catch (error) {
      console.error('❌ 获取可用设备失败:', error);
      message.error('获取可用设备失败');
      setAvailableDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  };

  // 获取服务类型列表
  const fetchServiceTypes = async () => {
    try {
      console.log('🔄 开始获取服务类型列表...');
      const response = await serviceTypeAPI.getAllActiveServiceTypes();
      console.log('📋 服务类型API响应:', response);
      
      if ((response as any).success && (response as any).data) {
        const types = (response as any).data.map((type: any) => ({
          label: type.name,
          value: type.name,
          color: type.color
        }));
        console.log('✅ 成功获取服务类型:', types);
        setServiceTypes(types);
      } else {
        console.warn('⚠️ 服务类型API响应格式异常:', response);
        message.warning('获取服务类型失败，请检查服务类型管理');
        setServiceTypes([]);
      }
    } catch (error) {
      console.error('❌ 获取服务类型失败:', error);
      message.error('获取服务类型失败，请先在系统设置中创建服务类型');
      setServiceTypes([]);
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        page_size: pagination.pageSize,
        search: searchText || undefined,
      };
      
      console.log('获取账号列表参数:', params);
      const response: any = await accountAPI.getAccountList(params);
      console.log('账号列表响应:', response);
      
      if (response.success && response.data) {
        setAccounts(response.data.accounts || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0,
        }));
        
        // 同时获取设备统计信息以便在表格中显示
        await fetchAvailableDevices();
      } else {
        message.error('获取账号列表失败：响应格式错误');
      }
    } catch (error: any) {
      console.error('获取账号列表失败:', error);
      message.error(`获取账号列表失败: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 图片上传处理函数
  const handleImageChange = (info: any) => {
    console.log('📸 图片上传状态变化:', info.file.status, info.file);
    
    // 直接处理文件，不依赖上传状态
    const file = info.file.originFileObj || info.file;
    if (file && file instanceof File) {
      console.log('📷 开始处理图片文件:', file.name, file.size);
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        console.log('📷 图片转换为Base64成功，长度:', base64.length);
        console.log('📷 设置新上传的图片到状态');
        setImageUrl(base64);
        setFileList([{
          uid: info.file.uid || Date.now().toString(),
          name: info.file.name || 'image',
          status: 'done',
          url: base64,
        }]);
        message.success('图片上传成功！');
      };
      reader.onerror = () => {
        console.error('❌ 图片读取失败');
        message.error('图片读取失败，请重试');
      };
      reader.readAsDataURL(file);
    } else {
      console.log('📸 处理上传状态变化:', info.file.status);
      if (info.file.status === 'uploading') {
        setFileList(info.fileList);
      }
    }
  };

  // 图片上传前的验证
  const beforeUpload = (file: File) => {
    console.log('🔍 验证上传文件:', file.name, file.type, file.size);
    
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isJpgOrPng) {
      message.error('只能上传 JPG/PNG 格式的图片!');
      return false;
    }
    const isLt1M = file.size / 1024 / 1024 < 1;
    if (!isLt1M) {
      message.error('图片大小不能超过 1MB!');
      return false;
    }
    
    console.log('✅ 文件验证通过');
    // 返回 false 阻止自动上传，我们在 onChange 中手动处理
    return false;
  };

  const handleAdd = async () => {
    console.log('添加新账号');
    setEditingAccount(null);
    setFileList([]);
    setImageUrl('');
    form.resetFields();
    form.setFieldsValue({ status: 'active' });
    setModalVisible(true);
    
    // 获取可用设备列表
    await fetchAvailableDevices();
  };

  const handleEdit = (account: Account) => {
    console.log('🔧 编辑账号:', account);
    setEditingAccount(account);
    
    // 重置图片状态
    setFileList([]);
    setImageUrl('');
    
    // 如果账号有图片，设置到状态中
    if (account.image_url && account.image_url.trim()) {
      console.log('🖼️ 设置现有图片:', account.image_url.substring(0, 50) + '...');
      setImageUrl(account.image_url);
      setFileList([{
        uid: '-1',
        name: 'current-image',
        status: 'done',
        url: account.image_url,
      }]);
    }
    
    // 重置表单并设置值
    form.resetFields();
    form.setFieldsValue({
      account_name: account.account_name,
      username: account.username,
      password: account.password,
      type: account.type,
      description: account.description,
      status: account.status
    });
    
    setModalVisible(true);
  };

  const handleDelete = async (accountId: number) => {
    try {
      await accountAPI.deleteAccount(accountId);
      message.success('账号删除成功');
      fetchAccounts();
    } catch (error: any) {
      console.error('删除账号失败:', error);
      const errorMessage = error.response?.data?.detail || error.message || '删除账号失败';
      message.error(errorMessage);
    }
  };

  // 图片预览处理函数
  const handlePreviewImage = (imageUrl: string, accountName: string) => {
    setPreviewImage(imageUrl);
    setPreviewTitle(`${accountName} - 账号缩略图预览`);
    setPreviewVisible(true);
  };

  const handlePreviewCancel = () => {
    setPreviewVisible(false);
    setPreviewImage('');
    setPreviewTitle('');
  };

  const handleSubmit = async (values: AccountFormData) => {
    console.log('🚀 表单提交开始');
    console.log('📝 表单数据:', values);
    console.log('✏️ 编辑模式:', editingAccount ? '是' : '否');
    console.log('📸 当前图片URL长度:', imageUrl ? imageUrl.length : 0);
    console.log('📸 当前图片URL前50字符:', imageUrl ? imageUrl.substring(0, 50) : 'null');
    
    const loadingMessage = message.loading(editingAccount ? '正在更新账号...' : '正在创建账号...', 0);
    
    try {
      const submitData = { ...values };
      
      // 图片处理逻辑 - 优先使用当前状态中的图片
      if (imageUrl && imageUrl.trim()) {
        console.log('📷 使用当前状态中的图片，长度:', imageUrl.length);
        console.log('📷 图片类型:', imageUrl.startsWith('data:image/') ? 'Base64' : 'URL');
        submitData.image_url = imageUrl;
      } else if (editingAccount && editingAccount.image_url) {
        // 编辑模式且没有新图片，保持原有图片
        console.log('🔗 保持原有图片，长度:', editingAccount.image_url.length);
        submitData.image_url = editingAccount.image_url;
      } else {
        // 新建账号且没有上传图片，使用默认图片
        console.log('📷 使用默认图片');
        submitData.image_url = `https://via.placeholder.com/150x150.png?text=${encodeURIComponent(values.account_name || 'Account')}`;
      }

      console.log('📋 最终提交数据:', {
        account_name: submitData.account_name,
        username: submitData.username,
        type: submitData.type,
        status: submitData.status,
        image_url_length: submitData.image_url ? submitData.image_url.length : 0,
        image_url_type: submitData.image_url ? (submitData.image_url.startsWith('data:image/') ? 'Base64' : 'URL') : 'none'
      });

      let response;
      if (editingAccount) {
        console.log('🔄 执行账号更新...');
        response = await accountAPI.updateAccount(editingAccount.id, submitData);
        console.log('✅ 更新响应:', response);
        message.success('账号更新成功');
      } else {
        console.log('➕ 执行账号创建...');
        response = await accountAPI.createAccount(submitData);
        console.log('✅ 创建响应:', response);
        message.success('账号创建成功');
      }
      
      loadingMessage();
      setModalVisible(false);
      form.resetFields();
      setEditingAccount(null);
      setFileList([]);
      setImageUrl('');
      
      await fetchAccounts();
      console.log('✅ 操作完成');
      
    } catch (error: any) {
      console.error('❌ 提交失败:', error);
      loadingMessage();
      const errorMessage = error.response?.data?.detail || error.message || '操作失败';
      message.error(editingAccount ? `更新账号失败: ${errorMessage}` : `创建账号失败: ${errorMessage}`);
    }
  };

  const handleTableChange = (paginationConfig: any) => {
    setPagination({
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
      total: pagination.total,
    });
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // 获取账号类型对应的颜色
  const getTypeColor = (type: string): string => {
    const colorMap: { [key: string]: string } = {
      wechat: '#07C160',
      qq: '#12B7F5',
      alipay: '#1677FF',
      taobao: '#FF6A00',
      jd: '#E1251B',
      douyin: '#000000',
      kuaishou: '#FF6600',
      xiaohongshu: '#FF2442',
      telegram: '#0088CC',
      whatsapp: '#25D366',
      other: '#8C8C8C'
    };
    return colorMap[type] || '#8C8C8C';
  };

  // 获取账号类型对应的图标
  const getTypeIcon = (type: string): string => {
    const iconMap: { [key: string]: string } = {
      wechat: '微',
      qq: 'Q',
      alipay: '支',
      taobao: '淘',
      jd: '京',
      douyin: '抖',
      kuaishou: '快',
      xiaohongshu: '小',
      telegram: 'T',
      whatsapp: 'W',
      other: '其'
    };
    return iconMap[type] || '?';
  };

  const columns: ColumnsType<Account> = [
    {
      title: '账号缩略图',
      dataIndex: 'image_url',
      key: 'image_url',
      width: 100,
      render: (url, record) => {
        console.log('🖼️ 渲染头像 - 账号:', record.account_name, 'URL长度:', url?.length || 0);
        
        const hasValidImage = url && url.trim() && url !== 'null' && url !== 'undefined' && url.length > 10;
        
        if (hasValidImage) {
          const isBase64 = url.startsWith('data:image/');
          
          if (isBase64) {
            console.log('📸 Base64图片 - 账号:', record.account_name);
            return (
              <div 
                style={{ 
                  position: 'relative',
                  cursor: 'pointer',
                  display: 'inline-block'
                }}
                onClick={() => handlePreviewImage(url, record.account_name)}
              >
                <img
                  src={url}
                  alt={record.account_name}
                  style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: '4px', 
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    console.error('❌ Base64图片加载失败:', record.account_name);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div style="
                          width: 40px; 
                          height: 40px; 
                          background: ${getTypeColor(record.type)};
                          border-radius: 4px;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          font-size: 12px;
                          color: #fff;
                          font-weight: bold;
                        ">
                          ${getTypeIcon(record.type)}
                        </div>
                      `;
                    }
                  }}
                  onLoad={() => {
                    console.log('✅ Base64图片加载成功:', record.account_name);
                  }}
                />
                <div style={{ 
                  fontSize: '10px', 
                  color: '#666', 
                  textAlign: 'center',
                  marginTop: '2px'
                }}>
                  点击预览
                </div>
              </div>
            );
          } else {
            console.log('🌐 外部URL图片 - 账号:', record.account_name);
            return (
              <Image
                width={40}
                height={40}
                src={url}
                style={{ borderRadius: '4px', objectFit: 'cover' }}
                fallback={`https://via.placeholder.com/40x40/${getTypeColor(record.type).replace('#', '')}/ffffff?text=${getTypeIcon(record.type)}`}
                preview={{
                  mask: <EyeOutlined style={{ fontSize: '14px' }} />
                }}
              />
            );
          }
        }
        
        // 默认头像
        console.log('📷 使用默认头像:', record.account_name, record.type);
        return (
          <div style={{ 
            width: 40, 
            height: 40, 
            background: getTypeColor(record.type),
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#fff',
            fontWeight: 'bold'
          }}>
            {getTypeIcon(record.type)}
          </div>
        );
      },
    },
    {
      title: '账号名称',
      dataIndex: 'account_name',
      key: 'account_name',
      width: 150,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      width: 120,
      render: (password) => (
        <span style={{ fontFamily: 'monospace' }}>
          {'*'.repeat(Math.min(password?.length || 0, 8))}
        </span>
      ),
    },
    {
      title: '服务类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => {
        const typeLabel = serviceTypes.find(t => t.value === type)?.label || type;
        return <Tag color="blue">{typeLabel}</Tag>;
      },
    },
    {
      title: '绑定设备',
      key: 'primary_device',
      width: 250,
      render: (_, record) => {
        if (record.primary_device) {
          const device = record.primary_device;
          // 从availableDevices中获取绑定统计信息
          const deviceStats = availableDevices.find(d => d.id === device.id);
          const boundCount = deviceStats?.bound_accounts_count || 0;
          
          return (
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                📱 {device.brand} {device.model}
              </div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                ID: {device.device_id}
              </div>
              <div style={{ fontSize: '11px', color: '#666' }}>
                📞 {device.phone_number || '未设置'}
              </div>
              <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag color={device.is_online ? 'green' : 'red'} style={{ fontSize: '10px' }}>
                  {device.is_online ? '在线' : '离线'}
                </Tag>
                <Tag color="blue" style={{ fontSize: '10px' }}>
                  👥 共绑定{boundCount}个账号
                </Tag>
              </div>
            </div>
          );
        }
        return (
          <div style={{ color: '#999', fontSize: '12px' }}>
            未绑定设备
          </div>
        );
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => {
        const statusConfig = {
          active: { color: 'green', text: '正常' },
          inactive: { color: 'red', text: '禁用' },
          suspended: { color: 'orange', text: '暂停' }
        };
        const config = statusConfig[status as keyof typeof statusConfig] || { color: 'gray', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个账号吗？"
            description={
              <div style={{ maxWidth: 300 }}>
                <div>删除账号将同时删除以下关联数据：</div>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>所有关联的访问链接</li>
                  <li>链接的访问记录和统计数据</li>
                </ul>
                <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  此操作不可恢复，请谨慎操作！
                </div>
              </div>
            }
            onConfirm={() => handleDelete(record.id)}
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>会员账号管理</Title>
          </Col>
          <Col>
            <Space>
              <Input.Search
                placeholder="搜索账号名称或用户名"
                allowClear
                onSearch={handleSearch}
                style={{ width: 250 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                添加会员账号
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchAccounts}
                loading={loading}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 账号列表表格 */}
        <Table
          columns={columns}
          dataSource={accounts}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1300 }}
        />
      </Card>

      {/* 添加/编辑账号模态框 */}
      <Modal
        title={editingAccount ? '编辑会员账号' : '添加会员账号'}
        open={modalVisible}
        onCancel={() => {
          console.log('取消模态框');
          setModalVisible(false);
          form.resetFields();
          setEditingAccount(null);
          setFileList([]);
          setImageUrl('');
        }}
        footer={null}
        width={600}
        destroyOnClose={true}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ status: 'active' }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="account_name"
                label="账号名称"
                rules={[{ required: true, message: '请输入账号名称' }]}
              >
                <Input placeholder="请输入会员账号名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="服务类型"
                rules={[{ required: true, message: '请选择服务类型' }]}
              >
                <Select
                  placeholder="请选择服务类型"
                  options={serviceTypes}
                  showSearch
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入登录用户名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password placeholder="请输入登录密码" />
              </Form.Item>
            </Col>
          </Row>

          {/* 设备绑定部分 - 仅在创建账号时显示 */}
          {!editingAccount && (
            <Form.Item
              name="primary_device_id"
              label="绑定设备"
              rules={[{ required: true, message: '请选择要绑定的设备' }]}
              extra="每个账号必须绑定一个设备，用于接收短信验证码"
            >
              <Select
                placeholder="请选择要绑定的设备"
                loading={devicesLoading}
                onDropdownVisibleChange={(open) => {
                  if (open && availableDevices.length === 0) {
                    fetchAvailableDevices();
                  }
                }}
                optionRender={(option) => {
                  const device = availableDevices.find(d => d.id === option.value);
                  if (!device) return option.label;
                  
                  return (
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        📱 {device.brand} {device.model} ({device.device_id})
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        📞 手机号: {device.phone_number || '未设置'}
                      </div>
                      <div style={{ fontSize: '12px', marginTop: '2px' }}>
                        <Tag color={device.status_color}>
                          {device.status_text}
                        </Tag>
                        <span style={{ marginLeft: '8px', color: '#999' }}>
                          最后活跃: {device.last_active_text}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', marginTop: '4px', color: '#1890ff' }}>
                        👥 已绑定账号: {device.bound_accounts_count || 0} 个
                        {device.bound_accounts && device.bound_accounts.length > 0 && (
                          <span style={{ color: '#666', marginLeft: '8px' }}>
                            ({device.bound_accounts.map(acc => acc.account_name).join(', ')})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }}
              >
                {availableDevices.map(device => (
                  <Select.Option key={device.id} value={device.id}>
                    📱 {device.brand} {device.model} ({device.device_id}) - 已绑定{device.bound_accounts_count || 0}个账号
                  </Select.Option>
                ))}
              </Select>
              {availableDevices.length === 0 && !devicesLoading && (
                <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>
                  ⚠️ 暂无设备，请先确保有设备注册到系统中
                </div>
              )}
            </Form.Item>
          )}

          <Form.Item label="账号图片">
            <Upload
              name="image"
              listType="picture-card"
              className="avatar-uploader"
              showUploadList={false}
              beforeUpload={beforeUpload}
              onChange={handleImageChange}
              fileList={fileList}
            >
              {imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt="账号头像" 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    borderRadius: '6px'
                  }} 
                />
              ) : (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传图片</div>
                </div>
              )}
            </Upload>
            <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
              支持 JPG、PNG 格式，文件大小不超过 1MB
            </div>
          </Form.Item>

          <Form.Item
            name="description"
            label="账号描述"
          >
            <TextArea
              rows={3}
              placeholder="请输入会员账号描述信息，将在客户访问端展示"
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="status"
            label="账号状态"
            rules={[{ required: true, message: '请选择账号状态' }]}
          >
            <Select
              placeholder="请选择账号状态"
              options={statusOptions}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button 
                type="primary" 
                onClick={(e) => {
                  console.log('🔘🔘🔘 强制点击处理开始 🔘🔘🔘');
                  console.log('📋 表单实例:', form);
                  console.log('📝 当前表单值:', form.getFieldsValue());
                  
                  // 阻止默认行为
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // 强制获取表单值并提交
                  const formValues = form.getFieldsValue();
                  console.log('🔥 强制获取的表单值:', formValues);
                  
                  // 检查必填字段
                  let requiredFields = ['account_name', 'username', 'password', 'type', 'status'];
                  
                  // 创建账号时需要绑定设备
                  if (!editingAccount) {
                    requiredFields.push('primary_device_id');
                  }
                  
                  const missingFields = requiredFields.filter(field => !formValues[field]);
                  
                  if (missingFields.length > 0) {
                    console.error('❌ 缺少必填字段:', missingFields);
                    const fieldNames = missingFields.map(field => {
                      const nameMap: { [key: string]: string } = {
                        'account_name': '账号名称',
                        'username': '用户名',
                        'password': '密码',
                        'type': '服务类型',
                        'status': '账号状态',
                        'primary_device_id': '绑定设备'
                      };
                      return nameMap[field] || field;
                    });
                    message.error(`请填写必填字段: ${fieldNames.join(', ')}`);
                    return;
                  }
                  
                  console.log('✅ 所有必填字段已填写，开始提交');
                  handleSubmit(formValues);
                }}
                style={{
                  backgroundColor: '#1890ff',
                  borderColor: '#1890ff',
                  color: '#fff',
                  cursor: 'pointer',
                  pointerEvents: 'auto'
                }}
              >
                {editingAccount ? '🔥 强制更新' : '🔥 强制创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 图片预览模态框 */}
      <Modal
        open={previewVisible}
        title={previewTitle}
        footer={null}
        onCancel={handlePreviewCancel}
        width={800}
        centered
      >
        <div style={{ textAlign: 'center' }}>
          <Image
            src={previewImage}
            style={{ maxWidth: '100%', maxHeight: '70vh' }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
          />
        </div>
      </Modal>
    </div>
  );
};

export default AccountManagement;
