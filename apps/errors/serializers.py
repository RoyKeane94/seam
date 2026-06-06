from rest_framework import serializers


class ClientErrorReportSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=4000)
    stack = serializers.CharField(max_length=16000, required=False, allow_blank=True)
    path = serializers.CharField(max_length=2048, required=False, allow_blank=True)
    component = serializers.CharField(max_length=255, required=False, allow_blank=True)
