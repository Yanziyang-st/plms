package com.plms.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 业务配置，对应 application.yml 中的 {@code plms.*}。
 */
@ConfigurationProperties(prefix = "plms")
public class PlmsProperties {

    private Jwt jwt = new Jwt();
    private Nacos nacos = new Nacos();

    public static class Jwt {
        private String secret = "plms-default-secret-please-change";
        private int expireHours = 12;
        private String header = "Authorization";
        private String prefix = "Bearer ";

        public String getSecret() { return secret; }
        public void setSecret(String secret) { this.secret = secret; }
        public int getExpireHours() { return expireHours; }
        public void setExpireHours(int expireHours) { this.expireHours = expireHours; }
        public String getHeader() { return header; }
        public void setHeader(String header) { this.header = header; }
        public String getPrefix() { return prefix; }
        public void setPrefix(String prefix) { this.prefix = prefix; }
    }

    public static class Nacos {
        private boolean enabled = false;
        private String serverAddr = "127.0.0.1:8848";
        private String namespace = "";
        private String group = "DEFAULT_GROUP";
        private String clusterName = "DEFAULT";

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getServerAddr() { return serverAddr; }
        public void setServerAddr(String serverAddr) { this.serverAddr = serverAddr; }
        public String getNamespace() { return namespace; }
        public void setNamespace(String namespace) { this.namespace = namespace; }
        public String getGroup() { return group; }
        public void setGroup(String group) { this.group = group; }
        public String getClusterName() { return clusterName; }
        public void setClusterName(String clusterName) { this.clusterName = clusterName; }
    }

    public Jwt getJwt() { return jwt; }
    public void setJwt(Jwt jwt) { this.jwt = jwt; }
    public Nacos getNacos() { return nacos; }
    public void setNacos(Nacos nacos) { this.nacos = nacos; }
}
