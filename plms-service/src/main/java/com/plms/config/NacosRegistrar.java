package com.plms.config;

import com.alibaba.nacos.api.NacosFactory;
import com.alibaba.nacos.api.naming.NamingService;
import com.alibaba.nacos.api.naming.pojo.Instance;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.util.Properties;

/**
 * Nacos 服务注册（README 技术栈：服务发现 Nacos）。
 * <p>默认关闭（plms.nacos.enabled=false），单机可直接运行；
 * 启动 Nacos 后加 {@code --spring.profiles.active=nacos} 即可注册。</p>
 */
@Component
@ConditionalOnProperty(prefix = "plms.nacos", name = "enabled", havingValue = "true")
public class NacosRegistrar {

    private static final Logger log = LoggerFactory.getLogger(NacosRegistrar.class);

    private final PlmsProperties props;

    @Value("${server.port:8080}")
    private int port;

    @Value("${spring.application.name:plms-service}")
    private String serviceName;

    private NamingService namingService;

    public NacosRegistrar(PlmsProperties props) {
        this.props = props;
    }

    @PostConstruct
    public void register() {
        PlmsProperties.Nacos n = props.getNacos();
        try {
            Properties p = new Properties();
            p.setProperty("serverAddr", n.getServerAddr());
            if (!n.getNamespace().isBlank()) p.setProperty("namespace", n.getNamespace());

            Instance instance = new Instance();
            instance.setIp(InetAddress.getLocalHost().getHostAddress());
            instance.setPort(port);
            instance.setServiceName(serviceName);
            instance.setClusterName(n.getClusterName());
            instance.setHealthy(true);
            instance.setWeight(1.0);

            namingService = NacosFactory.createNamingService(p);
            namingService.registerInstance(serviceName, n.getGroup(), instance);
            log.info("Nacos 服务注册成功：{} -> {}:{}（group={}，server={}）",
                    serviceName, instance.getIp(), port, n.getGroup(), n.getServerAddr());
        } catch (Exception e) {
            log.error("Nacos 服务注册失败（不影响接口功能，仅服务发现不可用）：{}", e.getMessage());
        }
    }

    @PreDestroy
    public void deregister() {
        if (namingService == null) return;
        try {
            namingService.shutDown();
            log.info("Nacos 已注销服务：{}", serviceName);
        } catch (Exception e) {
            log.warn("Nacos 注销异常：{}", e.getMessage());
        }
    }
}
