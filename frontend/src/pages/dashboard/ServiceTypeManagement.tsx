import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  InputNumber,
  message,
  Space,
  Popconfirm,
  Tag,
  Card,
  Row,
  Col,
  Select
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { serviceTypeAPI } from '../../services/api';

const { Search } = Input;
const { Option } = Select;

interface ServiceType {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const ServiceTypeManagement: React.FC = () => {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingServiceType, setEditingServiceType] = useState<ServiceType | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // 获取服务类型列表
  const fetchServiceTypes = async (page = 1, search = '') => {
    setLoading(true);
    try {
      const response = await serviceTypeAPI.getServiceTypeList({
        page,
        page_size: pagination.pageSize,
        search
      });

      if ((response as any).success) {
        setServiceTypes((response as any).data.service_types);
        setPagination({
          ...pagination,
          current: page,
          total: (response as any).data.pagination.total
        });
      }
    } catch (error: any) {
      message.error(error.response?.data?.detail || '获取服务类型列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceTypes();
  }, []);

  // 创建或更新服务类型
  const handleSubmit = async (values: any) => {
    try {
      let response;
      if (editingServiceType) {
        response = await serviceTypeAPI.updateServiceType(editingServiceType.id, values);
      } else {
        response = await serviceTypeAPI.createServiceType(values);
      }

      if ((response as any).success) {
        message.success(editingServiceType ? '更新成功' : '创建成功');
        setModalVisible(false);
        setEditingServiceType(null);
        form.resetFields();
        fetchServiceTypes(pagination.current, searchText);
      }
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败');
    }
  };

  // 删除服务类型
  const handleDelete = async (id: number) => {
    try {
      const response = await serviceTypeAPI.deleteServiceType(id);

      if ((response as any).success) {
        message.success('删除成功');
        fetchServiceTypes(pagination.current, searchText);
      }
    } catch (error: any) {
      message.error(error.response?.data?.detail || '删除失败');
    }
  };

  // 打开编辑模态框
  const handleEdit = (serviceType: ServiceType) => {
    setEditingServiceType(serviceType);
    form.setFieldsValue(serviceType);
    setModalVisible(true);
  };

  // 搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchServiceTypes(1, value);
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的服务类型');
      return;
    }

    try {
      const response = await serviceTypeAPI.batchDeleteServiceTypes(
        selectedRowKeys.map(id => Number(id))
      );
      
      if ((response as any).success) {
        message.success((response as any).message);
        setSelectedRowKeys([]);
        fetchServiceTypes(pagination.current, searchText);
      }
    } catch (error: any) {
      message.error('批量删除失败：' + (error.response?.data?.detail || error.message));
    }
  };

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    onSelectAll: (selected: boolean, selectedRows: ServiceType[], changeRows: ServiceType[]) => {
      console.log('onSelectAll', selected, selectedRows, changeRows);
    },
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '服务类型名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ServiceType) => (
        <Space>
          {record.icon && <span style={{ color: record.color }}>{record.icon}</span>}
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 100,
      render: (color: string) => (
        color ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div 
              style={{ 
                width: 20, 
                height: 20, 
                backgroundColor: color, 
                marginRight: 8,
                border: '1px solid #d9d9d9'
              }} 
            />
            {color}
          </div>
        ) : '-'
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: ServiceType) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个服务类型吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Input.Group compact>
              <Input
                placeholder="搜索服务类型名称"
                allowClear
                value={searchText}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchText(value);
                  // 如果搜索框被清空，立即显示所有数据
                  if (value === '') {
                    handleSearch('');
                  }
                }}
                onPressEnter={(e) => handleSearch((e.target as HTMLInputElement).value)}
                style={{ width: 'calc(100% - 80px)' }}
              />
              <Button 
                type="primary" 
                icon={<SearchOutlined />}
                onClick={() => handleSearch(searchText)}
                style={{ width: '80px' }}
              >
                搜索
              </Button>
            </Input.Group>
          </Col>
          <Col span={16} style={{ textAlign: 'right' }}>
            <Space>
              {selectedRowKeys.length > 0 && (
                <Popconfirm
                  title={`确定要删除选中的 ${selectedRowKeys.length} 个服务类型吗？`}
                  onConfirm={handleBatchDelete}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger icon={<DeleteOutlined />}>
                    批量删除 ({selectedRowKeys.length})
                  </Button>
                </Popconfirm>
              )}
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchServiceTypes(pagination.current, searchText)}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingServiceType(null);
                  form.resetFields();
                  setModalVisible(true);
                }}
              >
                添加服务类型
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={serviceTypes}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range?.[0]}-${range?.[1]} 条，共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize: pageSize || 10 });
              fetchServiceTypes(page, searchText);
            },
          }}
        />
      </Card>

      <Modal
        title={editingServiceType ? '编辑服务类型' : '添加服务类型'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingServiceType(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            is_active: true,
            sort_order: 0
          }}
        >
          <Form.Item
            name="name"
            label="服务类型名称"
            rules={[
              { required: true, message: '请输入服务类型名称' },
              { max: 100, message: '名称不能超过100个字符' }
            ]}
          >
            <Input placeholder="请输入服务类型名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea 
              placeholder="请输入服务类型描述" 
              rows={3}
              maxLength={500}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="icon"
                label="图标"
              >
                <Input placeholder="图标名称 (如: CloudOutlined)" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="color"
                label="颜色"
              >
                <Input 
                  placeholder="颜色代码 (如: #1890ff)" 
                  addonBefore={
                    <div 
                      style={{ 
                        width: 20, 
                        height: 20, 
                        backgroundColor: form.getFieldValue('color') || '#d9d9d9' 
                      }} 
                    />
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sort_order"
                label="排序顺序"
              >
                <InputNumber 
                  min={0} 
                  max={9999} 
                  placeholder="排序顺序"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="is_active"
                label="状态"
                valuePropName="checked"
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingServiceType(null);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingServiceType ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ServiceTypeManagement;
